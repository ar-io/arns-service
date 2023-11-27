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
  ContractRecordResponse,
  ContractReservedResponse,
  KoaContext,
} from '../types';
import { getContractReadInteraction, getContractState } from '../api/warp';
import { getWalletInteractionsForContract } from '../api/graphql';
import { NotFoundError } from '../errors';
import { mismatchedInteractionCount } from '../metrics';

export async function contractHandler(ctx: KoaContext) {
  const { logger, warp } = ctx.state;
  const { contractTxId } = ctx.params;
  logger.debug('Fetching contract state', {
    contractTxId,
  });
  const { state, evaluationOptions, sortKey } = await getContractState({
    contractTxId,
    warp,
    logger,
  });
  ctx.body = {
    contractTxId,
    state,
    sortKey,
    evaluationOptions,
  };
}

export async function contractInteractionsHandler(ctx: KoaContext) {
  const { arweave, logger, warp } = ctx.state;
  const { contractTxId, address } = ctx.params;

  logger.debug('Fetching all contract interactions', {
    contractTxId,
  });
  const [{ validity, errorMessages, evaluationOptions }, { interactions }] =
    await Promise.all([
      getContractState({
        contractTxId,
        warp,
        logger,
      }),
      getWalletInteractionsForContract(arweave, {
        address,
        contractTxId,
      }),
    ]);
  const mappedInteractions = [...interactions.keys()].map((id: string) => {
    const interaction = interactions.get(id);
    if (interaction) {
      return {
        ...interaction,
        valid: validity[id] ?? false,
        ...(errorMessages[id] ? { error: errorMessages[id] } : {}),
        id,
      };
    }
    // record the mismatch so we can debug
    mismatchedInteractionCount.inc();
    return;
  });

  // TODO: maybe add a check here that gql and warp returned the same number of interactions
  ctx.body = {
    contractTxId,
    interactions: mappedInteractions,
    ...(address ? { address } : {}), // only include address if it was provided
    evaluationOptions,
  };
}

export async function contractFieldHandler(ctx: KoaContext) {
  const { contractTxId, field } = ctx.params;
  const { logger, warp } = ctx.state;
  logger.debug('Fetching contract field', {
    contractTxId,
    field,
  });
  const { state, evaluationOptions } = await getContractState({
    contractTxId,
    warp,
    logger,
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
    evaluationOptions,
  };
}

export async function contractBalanceHandler(ctx: KoaContext) {
  const { contractTxId, address } = ctx.params;
  const { logger, warp } = ctx.state;
  logger.debug('Fetching contract balance for wallet', {
    contractTxId,
    wallet: address,
  });
  const { state, evaluationOptions } = await getContractState({
    contractTxId,
    warp,
    logger,
  });
  const balance = state['balances'][address];

  ctx.body = {
    contractTxId,
    address,
    balance: balance ?? 0,
    evaluationOptions,
  };
}

export async function contractRecordHandler(ctx: KoaContext) {
  const { contractTxId, name } = ctx.params;
  const { warp, logger: _logger } = ctx.state;

  const logger = _logger.child({
    contractTxId,
    record: name,
  });

  logger.debug('Fetching contract record');
  const { state, evaluationOptions } = await getContractState({
    contractTxId,
    warp,
    logger,
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
      // don't set evaluation options for sub contracts - they'll be pulled on load
    });
    response['owner'] = antContract?.owner;
    response['evaluationOptions'] = evaluationOptions;
  }

  ctx.body = response;
}

export async function contractRecordFilterHandler(ctx: KoaContext) {
  const { contractTxId } = ctx.params;
  const { warp, logger: _logger } = ctx.state;
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

  const { state, evaluationOptions } = await getContractState({
    contractTxId,
    warp,
    logger,
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
    // TODO: include filters in response
    evaluationOptions,
  };
}

export async function contractReservedHandler(ctx: KoaContext) {
  const { contractTxId, name } = ctx.params;
  const { warp, logger: _logger } = ctx.state;

  const logger = _logger.child({
    contractTxId,
    record: name,
  });

  const { state, evaluationOptions } = await getContractState({
    contractTxId,
    warp,
    logger,
  });
  const reservedName = state['reserved'][name];

  const response: ContractReservedResponse = {
    contractTxId,
    name,
    reserved: !!reservedName,
    ...(reservedName ? { details: reservedName } : {}),
    evaluationOptions,
  };

  ctx.body = response;
}

export async function contractReadInteractionHandler(ctx: KoaContext) {
  const { contractTxId, functionName } = ctx.params;
  const { warp, logger: _logger } = ctx.state;
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
