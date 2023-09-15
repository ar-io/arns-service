import {
  EvalStateResult,
  EvaluationManifest,
  EvaluationOptions,
  Warp,
} from 'warp-contracts';
import {
  DEFAULT_EVALUATION_OPTIONS,
  EVALUATION_TIMEOUT_MS,
  allowedContractTypes,
} from '../constants';
import { ContractType } from '../types';
import * as _ from 'lodash';
import { EvaluationTimeoutError } from '../errors';
import { createHash } from 'crypto';
import Arweave from 'arweave';
import { Tag } from 'arweave/node/lib/transaction';
import { ReadThroughPromiseCache } from '@ardrive/ardrive-promise-cache';
import winston from 'winston';

export type EvaluatedContractState = EvalStateResult<any> & {
  evaluationOptions?: Partial<EvaluationOptions>;
};

export class EvaluationError extends Error {
  constructor(message?: string) {
    super(message);
  }
}

// cache duplicate requests on the same instance within a short period of time
const requestMap: Map<string, Promise<any> | undefined> = new Map();

// Convenience class for read through caching
class ContractStateCacheKey {
  constructor(
    public readonly contractTxId: string,
    public readonly evaluationOptions: Partial<EvaluationOptions>,
    public readonly warp: Warp,
    public readonly logger?: winston.Logger,
  ) {}

  toString(): string {
    return `${this.contractTxId}-${createQueryParamHash(
      this.evaluationOptions,
    )}`;
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
    cacheCapacity: 100,
    cacheTTL: 1000 * 30, // 30 seconds
  },
  readThroughFunction: (cacheKey) => readThroughToContractState(cacheKey),
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

// Aggressively cache contract manifests since they're permanent on chain
const contractManifestCache: ReadThroughPromiseCache<
  ContractManifestCacheKey,
  any
> = new ReadThroughPromiseCache({
  cacheParams: {
    cacheCapacity: 1000,
    cacheTTL: 1000 * 60 * 60 * 24 * 365, // 365 days - effectively permanent
  },
  readThroughFunction: (cacheKey) => readThroughToContractManifest(cacheKey),
});

function createQueryParamHash(evalOptions: Partial<EvaluationOptions>): string {
  // Function to calculate the hash of a string
  const hash = createHash('sha256');
  hash.update(JSON.stringify(evalOptions));
  return hash.digest('hex');
}

async function readThroughToContractState(
  cacheKey: ContractStateCacheKey,
): Promise<EvaluatedContractState> {
  const { contractTxId, evaluationOptions, warp, logger } = cacheKey;
  logger?.debug('Reading through to contract state...', {
    contractTxId,
    cacheKey: cacheKey.toString(),
  });
  const cacheId = cacheKey.toString();

  // Prevent multiple in-flight requests for the same contract state
  // This could be needed if the read through cache gets overwhelmed
  const inFlightRequest = requestMap.get(cacheId);
  if (inFlightRequest) {
    logger?.debug('Deduplicating in flight requests for contract state...', {
      contractTxId,
      cacheKey: cacheKey.toString(),
    });
    const { cachedValue } = await inFlightRequest;
    return {
      ...cachedValue,
      evaluationOptions,
    };
  } else {
    logger?.debug('Evaluating contract state...', {
      contractTxId,
      cacheKey: cacheKey.toString(),
    });
  }

  // use the combined evaluation options
  const contract = warp
    .contract(contractTxId)
    .setEvaluationOptions(evaluationOptions);

  // set cached value for multiple requests during initial promise
  const readStatePromise = contract.readState();
  requestMap.set(cacheId, readStatePromise);

  readStatePromise
    .catch((error) => {
      logger?.debug('Failed to evaluate contract state!', {
        contractTxId,
        cacheKey: cacheKey.toString(),
        error,
      });
    })
    .finally(() => {
      // remove the cached request whether it completes or fails
      requestMap.delete(cacheId);
    });

  // await the response
  const { cachedValue } = await requestMap.get(cacheId);
  logger?.debug('Successfully evaluated contract state.', {
    contractTxId,
    cacheKey: cacheKey.toString(),
  });

  return {
    ...cachedValue,
    evaluationOptions,
  };
}

// TODO: we can put this in a interface/class and update the resolved type
export async function getContractState({
  contractTxId,
  warp,
  evaluationOptionOverrides = DEFAULT_EVALUATION_OPTIONS,
  logger,
}: {
  contractTxId: string;
  warp: Warp;
  evaluationOptionOverrides?: Partial<EvaluationOptions>;
  logger: winston.Logger;
}): Promise<EvaluatedContractState> {
  try {
    // get the contract manifest eval options by default
    const { evaluationOptions: contractDefinedEvalOptions } =
      await getContractManifest({
        contractTxId,
        arweave: warp.arweave,
        logger,
      });
    // override any contract manifest eval options with eval options provided
    const combinedEvalOptions = {
      ...contractDefinedEvalOptions,
      ...evaluationOptionOverrides,
    };

    // Awaiting here so that promise rejection can be caught below, wrapped, and propagated
    return await contractStateCache.get(
      new ContractStateCacheKey(
        contractTxId,
        combinedEvalOptions,
        warp,
        logger,
      ),
    );
  } catch (error) {
    // throw an eval here so we can properly return correct status code
    if (
      error instanceof Error &&
      // reference: https://github.com/warp-contracts/warp/blob/92e3ec4bffdea27abb791c38b77a115d7c8bd8f5/src/contract/EvaluationOptionsEvaluator.ts#L134-L162
      (error.message.includes('Cannot proceed with contract evaluation') ||
        error.message.includes('Use contract.setEvaluationOptions'))
    ) {
      throw new EvaluationError(error.message);
    }
    throw error;
  }
}

async function readThroughToContractManifest({
  contractTxId,
  arweave,
  logger,
}: {
  contractTxId: string;
  arweave: Arweave;
  logger?: winston.Logger;
}): Promise<EvaluationManifest> {
  logger?.debug('Reading through to contract manifest...', {
    contractTxId,
  });
  const { tags: encodedTags } = await arweave.transactions.get(contractTxId);
  const decodedTags = tagsToObject(encodedTags);
  // this may not exist, so provided empty json object string as default
  const contractManifestString = decodedTags['Contract-Manifest'] ?? '{}';
  const contractManifest = JSON.parse(contractManifestString);
  return contractManifest;
}

export async function getContractManifest({
  contractTxId,
  arweave,
  logger,
}: {
  contractTxId: string;
  arweave: Arweave;
  logger?: winston.Logger;
}): Promise<EvaluationManifest> {
  return contractManifestCache.get(
    new ContractManifestCacheKey(contractTxId, arweave, logger),
  );
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

export async function validateStateWithTimeout({
  contractTxId,
  warp,
  type,
  address,
  logger,
}: {
  contractTxId: string;
  warp: Warp;
  type?: ContractType;
  address?: string;
  logger: winston.Logger;
}): Promise<unknown> {
  return Promise.race([
    validateStateAndOwnership({
      contractTxId,
      warp,
      type,
      address,
      logger,
    }),
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new EvaluationTimeoutError()),
        EVALUATION_TIMEOUT_MS,
      ),
    ),
  ]);
}

// TODO: this could be come a generic and return the full state of contract once validated
export async function validateStateAndOwnership({
  contractTxId,
  warp,
  type,
  address,
  logger,
}: {
  contractTxId: string;
  warp: Warp;
  type?: ContractType;
  address?: string;
  logger: winston.Logger;
}): Promise<boolean> {
  const { state } = await getContractState({
    contractTxId,
    warp,
    logger,
  });
  // TODO: use json schema validation schema logic. For now, these are just raw checks.
  const validateType =
    !type ||
    (type && type === 'ant' && state['records'] && state['records']['@']);
  const validateOwnership =
    !address ||
    (address && state['owner'] === address) ||
    state['controller'] === address;
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
