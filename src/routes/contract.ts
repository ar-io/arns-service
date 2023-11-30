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
  ArNSInteraction,
  ContractRecordResponse,
  ContractReservedResponse,
  KoaContext,
} from '../types';
import { getContractReadInteraction, getContractState } from '../api/warp';
import { getWalletInteractionsForContract } from '../api/graphql';
import { NotFoundError } from '../errors';
import { mismatchedInteractionCount } from '../metrics';

export async function contractHandler(ctx: KoaContext) {
  const { logger, warp, sortKey, blockHeight } = ctx.state;
  const { contractTxId } = ctx.params;
  logger.debug('Fetching contract state', {
    contractTxId,
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
  ctx.body = {
    contractTxId,
    state,
    sortKey: evaluatedSortKey,
    evaluationOptions,
  };
}

export async function contractInteractionsHandler(ctx: KoaContext) {
  const { arweave, logger, warp, sortKey, blockHeight } = ctx.state;
  const { contractTxId, address } = ctx.params;

  logger.debug('Fetching contract interactions', {
    contractTxId,
    sortKey,
    blockHeight,
  });
  const [
    { validity, errorMessages, evaluationOptions, sortKey: evaluatedSortKey },
    { interactions },
  ] = await Promise.all([
    getContractState({
      contractTxId,
      warp,
      logger,
      sortKey,
      blockHeight,
    }),
    getWalletInteractionsForContract(arweave, {
      address,
      contractTxId,
      sortKey,
      blockHeight,
    }),
  ]);

  const mappedInteractions = Array.from(interactions)
    .map(
      ([id, interaction]: [
        string,
        Omit<ArNSInteraction, 'valid' | 'errorMessage' | 'id'>,
      ]) => {
        // found in graphql but not by warp
        if (!Object.keys(validity).includes(id)) {
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
    )
    // sort them in descending order
    .sort((a, b) => {
      // prioritize sort key if it exists
      if (a.sortKey && b.sortKey) {
        return b.sortKey.localeCompare(a.sortKey);
      }
      return b.height - a.height;
    });

  ctx.body = {
    contractTxId,
    interactions: mappedInteractions,
    address,
    sortKey: evaluatedSortKey,
    evaluationOptions,
  };
}

export async function contractFieldHandler(ctx: KoaContext) {
  const { logger, warp, sortKey, blockHeight } = ctx.state;
  const { contractTxId, field } = ctx.params;
  logger.debug('Fetching contract field', {
    contractTxId,
    field,
    sortKey,
    blockHeight,
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
  const contractField = state[field];

  if (!contractField) {
    throw new NotFoundError(
      `Field '${field}' not found on contract '${contractTxId}'.`,
    );
  }

  ctx.body = {
    contractTxId,
    [field]: contractField,
    sortKey: evaluatedSortKey,
    evaluationOptions,
  };
}

export async function contractBalanceHandler(ctx: KoaContext) {
  const { logger, warp, sortKey, blockHeight } = ctx.state;
  const { contractTxId, address } = ctx.params;
  logger.debug('Fetching contract balance for wallet', {
    contractTxId,
    wallet: address,
    sortKey,
    blockHeight,
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
  const { warp, logger: _logger, sortKey, blockHeight } = ctx.state;
  const { contractTxId, name } = ctx.params;

  const logger = _logger.child({
    contractTxId,
    record: name,
    sortKey,
    blockHeight,
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
    sortKey,
    blockHeight,
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
      blockHeight,
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
  const { warp, logger: _logger, sortKey, blockHeight } = ctx.state;
  const { contractTxId, name } = ctx.params;

  const logger = _logger.child({
    contractTxId,
    record: name,
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

// TODO: add sortKey and blockHeight support
export async function contractReadInteractionHandler(ctx: KoaContext) {
  const { warp, logger: _logger } = ctx.state;
  const { contractTxId, functionName } = ctx.params;
  const { query: input } = ctx.request;

  const logger = _logger.child({
    contractTxId,
    functionName,
  });

  const parsedInput = Object.entries(input).reduce(
    (parsedParams: { [x: string]: any }, [key, value]) => {
      // parse known integer values
      if (typeof value === 'string' && !isNaN(+value)) {
        parsedParams[key] = +value;
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
    functionName,
    input: parsedInput,
  });

  ctx.body = {
    contractTxId,
    result,
    evaluationOptions,
  };
}
