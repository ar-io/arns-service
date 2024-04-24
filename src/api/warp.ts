/**
 * Copyright (C) 2022-2023 Permanent Data Solutions, Inc. All Rights Reserved.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
import {
  EvalStateResult,
  EvaluationManifest,
  EvaluationOptions,
  InteractionResult,
  SortKeyCacheResult,
  Warp,
} from 'warp-contracts';
import {
  DEFAULT_EVALUATION_OPTIONS,
  DEFAULT_PAGES_PER_BATCH,
  DEFAULT_STATE_EVALUATION_TIMEOUT_MS,
  INT_MAX_32_BIT,
  allowedContractTypes,
} from '../constants';
import { ContractType, EvaluatedContractState } from '../types';
import {
  EvaluationError,
  EvaluationTimeoutError,
  NotFoundError,
  UnknownError,
} from '../errors';
import * as _ from 'lodash';
import { createHash } from 'crypto';
import Arweave from 'arweave';
import { Tag } from 'arweave/node/lib/transaction';
import { ReadThroughPromiseCache } from '@ardrive/ardrive-promise-cache';
import winston from 'winston';
import { ParsedUrlQuery } from 'querystring';

// cache duplicate requests on the same instance within a short period of time
const stateRequestMap: Map<
  string,
  Promise<SortKeyCacheResult<EvalStateResult<unknown>>>
> = new Map();
const readRequestMap: Map<
  string,
  Promise<InteractionResult<unknown, unknown>>
> = new Map();

// Convenience class for read through caching
class ContractStateCacheKey {
  constructor(
    public readonly contractTxId: string,
    public readonly sortKey: string | undefined,
    public readonly blockHeight: number | undefined,
    public readonly evaluationOptions: Partial<EvaluationOptions>,
    public readonly warp: Warp,
    public readonly signal?: AbortSignal,
    public readonly logger?: winston.Logger,
  ) {}

  toString(): string {
    return `${this.contractTxId}-${createSortKeyBlockHeightHash({
      sortKey: this.sortKey,
      blockHeight: this.blockHeight,
    })}-${createQueryParamHash(this.evaluationOptions)}`;
  }

  // Facilitate ReadThroughPromiseCache key derivation
  toJSON() {
    return { cacheKey: this.toString() };
  }
}

// Cache contract states for 30 seconds since block time is around 2 minutes
const contractStateCache: ReadThroughPromiseCache<
  ContractStateCacheKey,
  EvaluatedContractState
> = new ReadThroughPromiseCache({
  cacheParams: {
    cacheCapacity: 10_000,
    cacheTTL: 1000 * 30, // 30 seconds
  },
  readThroughFunction: readThroughToContractState,
});

// Convenience class for read through caching
class ContractManifestCacheKey {
  constructor(
    public readonly contractTxId: string,
    public readonly arweave: Arweave,
    public readonly logger?: winston.Logger,
  ) {}

  // Facilitate ReadThroughPromiseCache key derivation
  toJSON() {
    return { contractTxId: this.contractTxId };
  }
}

class ContractReadInteractionCacheKey {
  constructor(
    public readonly contractTxId: string,
    public readonly functionName: string,
    public readonly input: any,
    public readonly warp: Warp,
    public readonly evaluationOptions: Partial<EvaluationOptions>,
    public readonly sortKey?: string,
    public readonly logger?: winston.Logger,
  ) {}

  toString(): string {
    return `${this.contractTxId}-${this.functionName}-${
      this.sortKey || 'latest'
    }-${createQueryParamHash(this.input)}-${createQueryParamHash(
      this.evaluationOptions,
    )}`;
  }

  // Facilitate ReadThroughPromiseCache key derivation
  toJSON() {
    return { cacheKey: this.toString() };
  }
}

// Cache contract read interactions for 30 seconds since block time is around 2 minutes
const contractReadInteractionCache: ReadThroughPromiseCache<
  ContractReadInteractionCacheKey,
  {
    result: unknown;
    input: unknown;
    evaluationOptions: Partial<EvaluationOptions>;
  }
> = new ReadThroughPromiseCache({
  cacheParams: {
    cacheCapacity: 1_000,
    cacheTTL: 1000 * 30, // 30 seconds
  },
  readThroughFunction: readThroughToContractReadInteraction,
});

// Aggressively cache contract manifests since they're permanent on chain
const contractManifestCache: ReadThroughPromiseCache<
  ContractManifestCacheKey,
  EvaluationManifest
> = new ReadThroughPromiseCache({
  cacheParams: {
    cacheCapacity: 1000,
    cacheTTL: 1000 * 60 * 60 * 24 * 365, // 365 days - effectively permanent
  },
  readThroughFunction: readThroughToContractManifest,
});

function createQueryParamHash(evalOptions: Partial<EvaluationOptions>): string {
  // Function to calculate the hash of a string
  const hash = createHash('sha256');
  hash.update(JSON.stringify(evalOptions));
  return hash.digest('hex');
}

function createSortKeyBlockHeightHash({
  sortKey,
  blockHeight,
}: {
  sortKey: string | undefined;
  blockHeight: number | undefined;
}) {
  const hash = createHash('sha256');
  hash.update(`${sortKey}-${blockHeight}`);
  return hash.digest('hex');
}

async function readThroughToContractState(
  cacheKey: ContractStateCacheKey,
): Promise<EvaluatedContractState> {
  const {
    contractTxId,
    evaluationOptions,
    sortKey: providedSortKey,
    blockHeight: providedBlockHeight,
    warp,
    logger,
    signal,
  } = cacheKey;
  logger?.debug('Reading through to contract state...', {
    contractTxId,
    cacheKey: cacheKey.toString(),
  });
  const cacheId = cacheKey.toString();

  // Prevent multiple in-flight requests for the same contract state
  // This could be needed if the read through cache gets overwhelmed
  const inFlightRequest = stateRequestMap.get(cacheId);
  if (inFlightRequest) {
    logger?.debug('Deduplicating in flight requests for contract state...', {
      contractTxId,
      cacheKey: cacheKey.toString(),
    });
    const { cachedValue, sortKey } = await inFlightRequest;
    return {
      ...cachedValue,
      sortKey,
      evaluationOptions,
    };
  }

  // use the combined evaluation options
  const contract = warp.contract(contractTxId).setEvaluationOptions({
    ...evaluationOptions,
    // Temporary fix: protect against setting a maxInteractionEvaluationTimeSeconds that is too large, warp should do this on all evaluation options
    // Reference: https://github.com/warp-contracts/warp/issues/509
    maxInteractionEvaluationTimeSeconds: Math.min(
      INT_MAX_32_BIT,
      evaluationOptions.maxInteractionEvaluationTimeSeconds ||
        DEFAULT_EVALUATION_OPTIONS.maxInteractionEvaluationTimeSeconds,
    ),
  });

  // only use batch read if no block height or sort key provided
  const doBatchRead = !providedSortKey && !providedBlockHeight;
  logger?.debug('Evaluating contract state...', {
    contractTxId,
    cacheKey: cacheKey.toString(),
    doBatchRead, // there is a bug in warp where readStateBatch is not properly using sortKeys
    evaluationOptions,
  });

  const readStatePromise = doBatchRead
    ? contract.readStateBatch(DEFAULT_PAGES_PER_BATCH, undefined, signal)
    : contract.readState(
        providedSortKey || providedBlockHeight,
        undefined,
        signal,
      );

  // set cached value for multiple requests during initial promise
  stateRequestMap.set(cacheId, readStatePromise);

  readStatePromise
    .catch((error: unknown) => {
      logger?.debug('Failed to evaluate contract state!', {
        contractTxId,
        cacheKey: cacheKey.toString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    })
    .finally(() => {
      logger?.debug('Removing request from in-flight cache.', {
        cacheId,
      });
      // remove the cached request whether it completes or fails
      stateRequestMap.delete(cacheId);
    });

  // await the response
  const stateEvaluationResult = await stateRequestMap.get(cacheId);
  if (!stateEvaluationResult) {
    logger?.error('Contract state did not return a result!', {
      contractTxId,
      cacheKey: cacheKey.toString(),
      sortKey: providedSortKey,
    });
    throw new UnknownError(`Unknown error occurred evaluating contract state.`);
  }

  const { cachedValue, sortKey: evaluatedSortKey } = stateEvaluationResult;
  logger?.debug('Successfully evaluated contract state.', {
    contractTxId,
    cacheKey: cacheKey.toString(),
    evaluatedSortKey,
    providedSortKey,
  });

  return {
    ...cachedValue,
    sortKey: evaluatedSortKey,
    evaluationOptions,
  };
}

export function handleWarpErrors(error: unknown): Error {
  /**
   * Warp throws various errors that we need to parse to know what status code to return to clients.
   * They also don't expose their error types in the SDK, hence why we have to cast to any for some of these checks.
   *
   * e.g.
   *
   * ArweaveError
   *    at Transactions.get (/../transactions.ts:94:13)
   *    at processTicksAndRejections (node:internal/process/task_queues:95:5)
   *    at async ReadThroughPromiseCache.readThroughToContractManifest [as readThroughFunction] (~/src/api/warp.ts:208:33) {
   *      type: 'TX_NOT_FOUND',
   *      response: undefined
   *  }
   */

  if (
    error instanceof Error &&
    // reference: https://github.com/warp-contracts/warp/blob/92e3ec4bffdea27abb791c38b77a115d7c8bd8f5/src/contract/EvaluationOptionsEvaluator.ts#L134-L162
    (error.message.includes('Cannot proceed with contract evaluation') ||
      error.message.includes('Use contract.setEvaluationOptions'))
  ) {
    return new EvaluationError(error.message);
  } else if (error instanceof Error && error.name === 'AbortError') {
    return new EvaluationTimeoutError();
  } else if (error instanceof Error && error.message.includes('404')) {
    return new NotFoundError(error.message);
  } else if (
    (error instanceof Error &&
      (error as any).type &&
      ['TX_NOT_FOUND', 'TX_INVALID'].includes((error as any).type)) ||
    (typeof error === 'string' && (error as string).includes('TX_INVALID'))
  ) {
    return new NotFoundError(`Contract not found. ${error}`);
  } else if (error instanceof Error) {
    // likely an error thrown directly by warp, so just rethrow it, or an error thrown by us (EvaluationTimeoutError)
    return error;
  } else {
    // something gnarly happened
    return new UnknownError(
      `Unknown error occurred evaluating contract. ${error}`,
    );
  }
}

// TODO: we can put this in a interface/class and update the resolved type
export async function getContractState({
  contractTxId,
  warp,
  logger,
  sortKey = undefined,
  blockHeight = undefined,
  signal,
}: {
  contractTxId: string;
  warp: Warp;
  logger: winston.Logger;
  sortKey?: string | undefined;
  blockHeight?: number | undefined;
  signal?: AbortSignal;
}): Promise<EvaluatedContractState> {
  try {
    // get the contract manifest eval options by default
    const { evaluationOptions = DEFAULT_EVALUATION_OPTIONS } =
      await contractManifestCache.get(
        new ContractManifestCacheKey(contractTxId, warp.arweave, logger),
      );
    // Awaiting here so that promise rejection can be caught below, wrapped, and propagated
    return await contractStateCache.get(
      new ContractStateCacheKey(
        contractTxId,
        sortKey,
        blockHeight,
        evaluationOptions,
        warp,
        signal,
        logger,
      ),
    );
  } catch (error) {
    throw handleWarpErrors(error);
  }
}

export async function readThroughToContractReadInteraction(
  cacheKey: ContractReadInteractionCacheKey,
): Promise<{
  result: unknown;
  sortKey: string | undefined;
  evaluationOptions: Partial<EvaluationOptions>;
  input: unknown;
}> {
  const {
    contractTxId,
    evaluationOptions,
    sortKey,
    warp,
    logger,
    functionName,
    input,
  } = cacheKey;
  logger?.debug('Reading through to contract read interaction...', {
    contractTxId,
    cacheKey: cacheKey.toString(),
    sortKey,
  });
  const cacheId = cacheKey.toString();

  // Prevent multiple in-flight requests for the same contract state
  // This could be needed if the read through cache gets overwhelmed
  const inFlightRequest = readRequestMap.get(cacheId);
  if (inFlightRequest) {
    logger?.debug('Deduplicating in flight requests for read interaction...', {
      contractTxId,
      cacheKey: cacheKey.toString(),
      sortKey,
    });
    const { result } = await inFlightRequest;
    return {
      result,
      input,
      sortKey,
      evaluationOptions,
    };
  }

  logger?.debug('Evaluating contract read interaction...', {
    contractTxId,
    cacheKey: cacheKey.toString(),
  });

  // use the combined evaluation options
  const contract = warp
    .contract(contractTxId)
    .setEvaluationOptions(evaluationOptions);

  // set cached value for multiple requests during initial promise
  const readInteractionPromise = contract.viewState(
    {
      function: functionName,
      ...input,
    },
    undefined, // tags
    undefined, // transfer
    undefined, // caller
    AbortSignal.timeout(DEFAULT_STATE_EVALUATION_TIMEOUT_MS),
    sortKey,
  );
  readRequestMap.set(cacheId, readInteractionPromise);

  readInteractionPromise
    .catch((error: unknown) => {
      logger?.debug('Failed to evaluate read interaction on contract!', {
        contractTxId,
        cacheKey: cacheKey.toString(),
        sortKey,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    })
    .finally(() => {
      logger?.debug('Removing request from in-flight cache.', {
        cacheId,
      });
      // remove the cached request whether it completes or fails
      readRequestMap.delete(cacheId);
    });

  // await the response
  const readInteractionResult = await readRequestMap.get(cacheId);

  // we shouldn't return read interactions that don't have a result
  if (!readInteractionResult) {
    logger?.error('Read interaction did not return a result!', {
      contractTxId,
      sortKey,
      cacheKey: cacheKey.toString(),
      input,
    });
    throw new UnknownError(
      `Failed to evaluate read interaction for ${contractTxId}.`,
    );
  }

  const { result, error, errorMessage } = readInteractionResult;

  if (error || errorMessage) {
    logger?.error('Read interaction failed!', {
      contractTxId,
      cacheKey: cacheKey.toString(),
      input,
      sortKey,
      error,
      errorMessage,
    });
    throw new EvaluationError(errorMessage);
  }

  logger?.debug('Successfully evaluated read interaction on contract.', {
    contractTxId,
    sortKey,

    cacheKey: cacheKey.toString(),
  });

  return {
    result,
    input,
    sortKey,
    evaluationOptions,
  };
}

export async function getContractReadInteraction({
  contractTxId,
  warp,
  logger,
  functionName,
  input,
  sortKey,
}: {
  contractTxId: string;
  warp: Warp;
  logger: winston.Logger;
  functionName: string;
  input: ParsedUrlQuery;
  sortKey?: string | undefined;
}): Promise<{
  result: any;
  evaluationOptions: Partial<EvaluationOptions>;
}> {
  try {
    const { evaluationOptions = DEFAULT_EVALUATION_OPTIONS } =
      await contractManifestCache.get(
        new ContractManifestCacheKey(contractTxId, warp.arweave, logger),
      );
    // use the combined evaluation options
    return await contractReadInteractionCache.get(
      new ContractReadInteractionCacheKey(
        contractTxId,
        functionName,
        input,
        warp,
        evaluationOptions,
        sortKey,
        logger,
      ),
    );
  } catch (error) {
    throw handleWarpErrors(error);
  }
}

async function readThroughToContractManifest({
  contractTxId,
  arweave,
  logger,
}: ContractManifestCacheKey): Promise<EvaluationManifest> {
  logger?.debug('Reading through to contract manifest...', {
    contractTxId,
  });
  const { tags: encodedTags } = await arweave.transactions
    .get(contractTxId)
    .catch((error: unknown) => {
      logger?.error('Failed to get contract manifest!', error);
      throw handleWarpErrors(error);
    });
  const decodedTags = tagsToObject(encodedTags);
  // this may not exist, so provided empty json object string as default
  const contractManifestString = decodedTags['Contract-Manifest'] ?? '{}';
  const contractManifest = JSON.parse(contractManifestString);
  return contractManifest;
}

export function tagsToObject(tags: Tag[]): {
  [x: string]: string;
} {
  return tags.reduce((decodedTags: { [x: string]: string }, tag) => {
    const key = tag.get('name', { decode: true, string: true });
    const value = tag.get('value', { decode: true, string: true });
    decodedTags[key] = value;
    return decodedTags;
  }, {});
}

// TODO: this could be come a generic and return the full state of contract once validated
export async function validateStateAndOwnership({
  contractTxId,
  warp,
  type,
  address,
  logger,
  signal,
  sortKey = undefined,
  blockHeight = undefined,
}: {
  contractTxId: string;
  warp: Warp;
  type?: ContractType;
  address?: string;
  logger: winston.Logger;
  signal: AbortSignal;
  sortKey?: string | undefined;
  blockHeight?: number | undefined;
}): Promise<boolean> {
  const { state } = await getContractState({
    contractTxId,
    warp,
    logger,
    sortKey,
    blockHeight,
    signal,
  });
  // TODO: use json schema validation schema logic. For now, these are just raw checks.
  const validateType =
    !type ||
    (type && type === 'ant' && state['records'] && state['records']['@']);

  const controllers = state['controllers'] ?? [];
  const validateOwnership =
    !address ||
    (address && state['owner'] === address) ||
    state['controller'] === address ||
    controllers.includes(address);
  return validateType && validateOwnership;
}

// validates that a provided query param is of a specific value
export function isValidContractType(
  type: string | string[] | undefined,
): type is ContractType {
  if (type instanceof Array) {
    return false;
  }

  return !type || (!!type && _.includes(allowedContractTypes, type));
}
