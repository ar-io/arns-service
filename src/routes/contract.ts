import { Next } from 'koa';

import {
  ContractRecordResponse,
  ContractReservedResponse,
  KoaContext,
  NotFoundError,
} from '../types';
import { getContractReadInteraction, getContractState } from '../api/warp';
import { getWalletInteractionsForContract } from '../api/graphql';

export async function contractHandler(ctx: KoaContext, next: Next) {
  const { logger, warp } = ctx.state;
  const { contractTxId } = ctx.params;
  logger.debug('Fetching contract state', {
    contractTxId,
  });
  const { state, evaluationOptions } = await getContractState({
    contractTxId,
    warp,
    logger,
  });
  ctx.body = {
    contractTxId,
    state,
    evaluationOptions,
  };

  return next();
}

export async function contractInteractionsHandler(ctx: KoaContext, next: Next) {
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
    return;
  });

  // TODO: maybe add a check here that gql and warp returned the same number of interactions
  ctx.body = {
    contractTxId,
    interactions: mappedInteractions,
    ...(address ? { address } : {}), // only include address if it was provided
    evaluationOptions,
  };

  return next();
}

export async function contractFieldHandler(ctx: KoaContext, next: Next) {
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

  return next();
}

export async function contractBalanceHandler(ctx: KoaContext, next: Next) {
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
  return next();
}

export async function contractRecordHandler(ctx: KoaContext, next: Next) {
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
  return next();
}

export async function contractRecordFilterHandler(ctx: KoaContext, next: Next) {
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
  return next();
}

export async function contractReservedHandler(ctx: KoaContext, next: Next) {
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
  return next();
}

export async function contractReadInteractionHandler(
  ctx: KoaContext,
  next: Next,
) {
  const { contractTxId, functionName } = ctx.params;
  const { warp, logger: _logger } = ctx.state;
  const { query: input } = ctx.request;

  const logger = _logger.child({
    contractTxId,
    functionName,
  });

  const { result, evaluationOptions } = await getContractReadInteraction({
    contractTxId,
    warp,
    logger,
    functionName,
    input,
  });

  ctx.body = {
    result,
    evaluationOptions,
  };
  return next();
}
