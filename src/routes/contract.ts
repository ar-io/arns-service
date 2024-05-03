/**
 * Copyright (C) 2022-2024 Permanent Data Solutions, Inc. All Rights Reserved.
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
  ContractRecordResponse,
  ContractReservedResponse,
  GenericContractInteraction,
  KoaContext,
} from '../types';
import { getContractReadInteraction, getContractState } from '../api/warp';
import { getWalletInteractionsForContract } from '../api/graphql';
import { BadRequestError, NotFoundError } from '../errors';
import { mismatchedInteractionCount } from '../metrics';
import {
  DEFAULT_STATE_EVALUATION_TIMEOUT_MS,
  MAX_PATH_DEPTH,
} from '../constants';
import { traverseObject } from '../utils';

export async function contractHandler(ctx: KoaContext) {
  const {
    logger,
    warp,
    sortKey: requestedSortKey,
    blockHeight: requestedBlockHeight,
    validity: requestedValidity,
  } = ctx.state;
  const { contractTxId } = ctx.params;
  logger.debug('Fetching contract state', {
    contractTxId,
    sortKey: requestedSortKey,
    blockHeight: requestedBlockHeight,
  });
  const {
    state,
    validity,
    evaluationOptions,
    sortKey: evaluatedSortKey,
  } = await getContractState({
    contractTxId,
    warp,
    logger,
    sortKey: requestedSortKey,
    blockHeight: requestedBlockHeight,
    signal: AbortSignal.timeout(DEFAULT_STATE_EVALUATION_TIMEOUT_MS),
  });
  ctx.body = {
    contractTxId,
    state,
    sortKey: evaluatedSortKey,
    evaluationOptions,
    ...(requestedValidity && { validity }),
  };
}

export async function contractInteractionsHandler(ctx: KoaContext) {
  const {
    arweave,
    logger,
    warp,
    sortKey: requestedSortKey,
    blockHeight: requestedBlockHeight,
    page: requestedPage,
    pageSize: requestedPageSize = 100,
    fn: requestedFunction,
  } = ctx.state;
  const { contractTxId, address } = ctx.params;

  logger.debug('Fetching contract interactions', {
    contractTxId,
    sortKey: requestedSortKey,
    blockHeight: requestedBlockHeight,
    requestedFunction,
    address,
  });

  /**
   * TODO: add a read through promise cache here that uses the following logic as the resulting promise. The cache key should contain the contractTxId, sortKey, blockHeight, address, page, and pageSize.
   */

  // use a synchronized abort signal to stop execution of both when either times out
  const abortSignal = AbortSignal.timeout(DEFAULT_STATE_EVALUATION_TIMEOUT_MS);
  const [
    { validity, errorMessages, evaluationOptions, sortKey: evaluatedSortKey },
    { interactions },
  ] = await Promise.all([
    getContractState({
      contractTxId,
      warp,
      logger,
      sortKey: requestedSortKey,
      blockHeight: requestedBlockHeight,
      signal: abortSignal,
    }),
    getWalletInteractionsForContract({
      arweave,
      address,
      contractTxId,
      blockHeight: requestedBlockHeight,
      logger,
      signal: abortSignal,
    }),
  ]);

  logger.debug('Mapping interactions', {
    contractTxId,
    sortKey: requestedSortKey,
    blockHeight: requestedBlockHeight,
    address,
  });

  let mappedInteractions = Array.from(interactions).map(
    ([id, interaction]: [string, GenericContractInteraction]) => {
      // found in graphql but not by warp
      if (validity[id] === undefined) {
        logger.debug(
          'Interaction found via GraphQL but not evaluated by warp',
          {
            contractTxId,
            interaction: id,
          },
        );
        mismatchedInteractionCount.inc();
      }

      return {
        ...interaction,
        valid: validity[id] ?? false,
        error: errorMessages[id],
        id,
      };
    },
  );

  // TODO: allow other filters
  if (requestedFunction) {
    logger.debug('Filtering interactions by function', {
      contractTxId,
      sortKey: requestedSortKey,
      blockHeight: requestedBlockHeight,
      address,
      requestedFunction,
    });
    mappedInteractions = mappedInteractions.filter(
      (interaction) => interaction.input?.function === requestedFunction,
    );
  }

  logger.debug('Sorting interactions', {
    contractTxId,
    sortKey: requestedSortKey,
    blockHeight: requestedBlockHeight,
    address,
  });

  // sort them in order
  mappedInteractions.sort((a, b) => {
    // prioritize sort key if it exists
    if (a.sortKey && b.sortKey) {
      return a.sortKey.localeCompare(b.sortKey);
    }
    return a.height - b.height;
  });

  logger.debug('Done sorting interactions', {
    contractTxId,
    sortKey: requestedSortKey,
    blockHeight: requestedBlockHeight,
    address,
  });

  // filter up to provided sort key
  if (requestedSortKey) {
    logger.debug('Filtering up to sort key', {
      contractTxId,
      sortKey: requestedSortKey,
      blockHeight: requestedBlockHeight,
      address,
      unfilteredCount: mappedInteractions.length,
    });
    const sortKeyIndex = mappedInteractions.findIndex(
      ({ sortKey: interactionSortKey }) =>
        interactionSortKey === requestedSortKey,
    );
    mappedInteractions = mappedInteractions.slice(0, sortKeyIndex + 1);

    logger.debug('Done filtering up to sort key', {
      contractTxId,
      sortKey: requestedSortKey,
      blockHeight: requestedBlockHeight,
      address,
      filteredCount: mappedInteractions.length,
    });
  }

  // sort them in descending order
  mappedInteractions = mappedInteractions.reverse();
  const totalInteractions = mappedInteractions.length;

  if (requestedPage !== undefined) {
    logger.debug('Paginating interactions', {
      contractTxId,
      sortKey: requestedSortKey,
      blockHeight: requestedBlockHeight,
      address,
      page: requestedPage,
      pageSize: requestedPageSize,
    });
    // this logic is 1 based
    const pageStartIndex = (requestedPage - 1) * requestedPageSize;
    const pageEndIndex = requestedPage * requestedPageSize;
    mappedInteractions = mappedInteractions.slice(pageStartIndex, pageEndIndex);
    logger.debug('Done paginating interactions', {
      contractTxId,
      sortKey: requestedSortKey,
      blockHeight: requestedBlockHeight,
      address,
      page: requestedPage,
      pageSize: requestedPageSize,
      pageStartIndex,
      pageEndIndex,
      totalCount: mappedInteractions.length,
    });
  }

  ctx.body = {
    contractTxId,
    address,
    sortKey: evaluatedSortKey,
    interactions: mappedInteractions,
    // only include page information if params were provided
    ...(requestedPage !== undefined && {
      pages: {
        page: requestedPage,
        pageSize: requestedPageSize,
        totalPages: Math.ceil(totalInteractions / requestedPageSize),
        totalItems: totalInteractions,
        hasNextPage:
          requestedPage < Math.ceil(totalInteractions / requestedPageSize),
      },
    }),
    evaluationOptions,
  };
}

/**
 * Deprecated endpoint, use /v1/contract/:contractTxId/state/:path instead
 * @param ctx
 */
export async function contractFieldHandler(ctx: KoaContext) {
  const {
    logger,
    warp,
    sortKey: requestedSortKey,
    blockHeight: requestedBlockHeight,
  } = ctx.state;
  const { contractTxId, field } = ctx.params;
  logger.debug('Fetching contract field', {
    contractTxId,
    field,
    sortKey: requestedSortKey,
    blockHeight: requestedBlockHeight,
  });
  const {
    state,
    evaluationOptions,
    sortKey: evaluatedSortKey,
  } = await getContractState({
    contractTxId,
    warp,
    logger,
    sortKey: requestedSortKey,
    blockHeight: requestedBlockHeight,
  });
  const result = state[field];

  if (result === undefined) {
    throw new NotFoundError(
      `Field '${field}' not found on contract '${contractTxId}'.`,
    );
  }

  ctx.body = {
    contractTxId,
    [field]: result,
    sortKey: evaluatedSortKey,
    evaluationOptions,
  };
}

/**
 * Recursively traverse a contract's state to get a nested field.
 * @param ctx
 */
export async function contractRecursiveFieldHandler(ctx: KoaContext) {
  const {
    logger,
    warp,
    sortKey: requestedSortKey,
    blockHeight: requestedBlockHeight,
  } = ctx.state;
  const { contractTxId, path } = ctx.params;
  const nestedFields = path.split('/');
  if (nestedFields.length > MAX_PATH_DEPTH) {
    throw new BadRequestError(
      `Unable to fetch state for '${path}'. Maximum path depth of ${MAX_PATH_DEPTH} exceed. Shorten your path and try again.`,
    );
  }
  logger.debug('Fetching contract field recursively', {
    contractTxId,
    path,
    sortKey: requestedSortKey,
    blockHeight: requestedBlockHeight,
  });
  const {
    state,
    evaluationOptions,
    sortKey: evaluatedSortKey,
  } = await getContractState({
    contractTxId,
    warp,
    logger,
    sortKey: requestedSortKey,
    blockHeight: requestedBlockHeight,
  });
  const result = traverseObject({
    object: state,
    path: nestedFields,
  });

  if (result === undefined) {
    throw new NotFoundError(
      `Field '${path}' not found on contract '${contractTxId}'.`,
    );
  }

  ctx.body = {
    contractTxId,
    result,
    sortKey: evaluatedSortKey,
    evaluationOptions,
  };
}

export async function contractBalanceHandler(ctx: KoaContext) {
  const {
    logger,
    warp,
    sortKey: requestedSortKey,
    blockHeight: requestedBlockHeight,
  } = ctx.state;
  const { contractTxId, address } = ctx.params;
  logger.debug('Fetching contract balance for wallet', {
    contractTxId,
    wallet: address,
    sortKey: requestedSortKey,
    blockHeight: requestedBlockHeight,
  });
  const {
    state,
    evaluationOptions,
    sortKey: evaluatedSortKey,
  } = await getContractState({
    contractTxId,
    warp,
    logger,
    sortKey: requestedSortKey,
    blockHeight: requestedBlockHeight,
  });
  const balance = state['balances'][address];

  ctx.body = {
    contractTxId,
    address,
    balance: balance ?? 0,
    sortKey: evaluatedSortKey,
    evaluationOptions,
  };
}

export async function contractRecordHandler(ctx: KoaContext) {
  const {
    warp,
    logger: _logger,
    sortKey: requestedSortKey,
    blockHeight: requestedBlockHeight,
  } = ctx.state;
  const { contractTxId, name } = ctx.params;

  const logger = _logger.child({
    contractTxId,
    record: name,
    sortKey: requestedSortKey,
    blockHeight: requestedBlockHeight,
  });

  logger.debug('Fetching contract record');
  const {
    state,
    evaluationOptions,
    sortKey: evaluatedSortKey,
  } = await getContractState({
    contractTxId,
    warp,
    logger,
    sortKey: requestedSortKey,
    blockHeight: requestedBlockHeight,
  });
  const record = state['records'][name];

  if (!record) {
    throw new NotFoundError(
      `Record '${name}' not found on contract ${contractTxId}.`,
    );
  }

  const response: ContractRecordResponse = {
    contractTxId,
    name,
    record,
    evaluationOptions,
    sortKey: evaluatedSortKey,
  };

  // get record details and contract state if it's from the source contract
  if (record.contractTxId) {
    logger.info('Fetching owner of record name', {
      contractTxId: record.contractTxId,
    });
    const { state: antContract, evaluationOptions } = await getContractState({
      contractTxId: record.contractTxId,
      warp,
      logger,
      // we cannot use sort key as it is not applicable to sub contract
      blockHeight: requestedBlockHeight,
    });
    response['owner'] = antContract?.owner;
    response['evaluationOptions'] = evaluationOptions;
  }

  ctx.body = response;
}

export async function contractRecordFilterHandler(ctx: KoaContext) {
  const { warp, logger: _logger, sortKey, blockHeight } = ctx.state;
  const { contractTxId } = ctx.params;

  // TODO: add other query filters (e.g. endTimestamp)
  const { contractTxId: filteredContractTxIds = [] } = ctx.query;

  // normalize to an array
  const filteredContractTxIdsArray = Array.isArray(filteredContractTxIds)
    ? filteredContractTxIds
    : [filteredContractTxIds];

  const logger = _logger.child({
    contractTxId,
    filters: {
      contractTxId: filteredContractTxIdsArray,
    },
  });

  const {
    state,
    evaluationOptions,
    sortKey: evaluatedSortKey,
  } = await getContractState({
    contractTxId,
    warp,
    logger,
    sortKey,
    blockHeight,
  });

  const { records = {} } = state;

  const associatedRecords = Object.entries(records).reduce(
    (
      filteredRecords: { [x: string]: any },
      [record, recordObj]: [string, any],
    ) => {
      if (
        !filteredContractTxIdsArray.length ||
        // TODO: make this more dynamic based on various filters
        (recordObj['contractTxId'] &&
          filteredContractTxIdsArray.includes(recordObj.contractTxId))
      ) {
        filteredRecords[record] = recordObj;
      }
      return filteredRecords;
    },
    {},
  );

  ctx.body = {
    contractTxId,
    records: associatedRecords,
    sortKey: evaluatedSortKey,
    // TODO: include filters in response
    evaluationOptions,
  };
}

export async function contractReservedHandler(ctx: KoaContext) {
  const {
    warp,
    logger: _logger,
    sortKey: requestedSortKey,
    blockHeight: requestedBlockHeight,
  } = ctx.state;
  const { contractTxId, name } = ctx.params;

  const logger = _logger.child({
    contractTxId,
    record: name,
    sortKey: requestedSortKey,
    blockHeight: requestedBlockHeight,
  });

  const {
    state,
    evaluationOptions,
    sortKey: evaluatedSortKey,
  } = await getContractState({
    contractTxId,
    warp,
    logger,
    sortKey: requestedSortKey,
    blockHeight: requestedBlockHeight,
  });
  const reservedName = state['reserved'][name];

  const response: ContractReservedResponse = {
    contractTxId,
    name,
    reserved: !!reservedName,
    ...(reservedName ? { details: reservedName } : {}),
    evaluationOptions,
    sortKey: evaluatedSortKey,
  };

  ctx.body = response;
}

const queryParamsCastedToNumbers = ['qty', 'years', 'height'];
export async function contractReadInteractionHandler(ctx: KoaContext) {
  const {
    warp,
    logger: _logger,
    sortKey: requestedSortKey,
    blockHeight: requestedBlockHeight,
  } = ctx.state;
  const { contractTxId, functionName } = ctx.params;
  const { query: input } = ctx.request;

  const logger = _logger.child({
    contractTxId,
    functionName,
  });

  let evaluateWithSortKey = requestedSortKey;
  if (!requestedSortKey && requestedBlockHeight) {
    const { sortKey } = await getContractState({
      contractTxId,
      warp,
      logger,
      blockHeight: requestedBlockHeight,
    });
    logger.info('Using sort key from block height', {
      blockHeight: requestedBlockHeight,
      sortKey,
    });
    evaluateWithSortKey = sortKey;
  }

  const parsedInput = Object.entries(input).reduce(
    (parsedParams: { [x: string]: any }, [key, value]) => {
      // parse known integer values for parameters we care about
      if (
        queryParamsCastedToNumbers.includes(key) &&
        typeof value === 'string' &&
        !isNaN(+value)
      ) {
        parsedParams[key] = +value;
        return parsedParams;
      }
      // exclude sortKey and blockHeight from input as they are used to evaluate the contract state
      if (key === 'sortKey' || key === 'blockHeight') {
        return parsedParams;
      }
      parsedParams[key] = value;
      return parsedParams;
    },
    {},
  );

  const { result, evaluationOptions } = await getContractReadInteraction({
    contractTxId,
    warp,
    logger,
    sortKey: evaluateWithSortKey,
    functionName,
    input: parsedInput,
  });

  ctx.body = {
    contractTxId,
    result,
    sortKey: evaluateWithSortKey,
    evaluationOptions,
  };
}
