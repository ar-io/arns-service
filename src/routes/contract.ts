import { Next } from 'koa';

import {
  ContractRecordResponse,
  ContractReservedResponse,
  KoaContext,
} from '../types';
import { EvaluationError, getContractState } from '../api/warp';
import { getWalletInteractionsForContract } from '../api/graphql';

export async function contractHandler(ctx: KoaContext, next: Next) {
  const { logger, warp } = ctx.state;
  const { contractTxId } = ctx.params;
  try {
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error.';
    logger.error('Failed to fetch contract', {
      contractTxId,
      error: message,
    });
    ctx.status = error instanceof EvaluationError ? 400 : 503;
    ctx.body = `Failed to fetch contract: ${contractTxId}. ${message}`;
  }

  return next();
}

export async function contractInteractionsHandler(ctx: KoaContext, next: Next) {
  const { arweave, logger, warp } = ctx.state;
  const { contractTxId, address } = ctx.params;

  try {
    logger.debug('Fetching all contract interactions', {
      contractTxId,
    });
    const [{ validity, errorMessages, evaluationOptions }, { interactions }] =
      await Promise.all([
        getContractState({
          contractTxId,
          warp,
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error.';
    logger.error('Failed to fetch contract interactions.', {
      contractTxId,
      error: message,
    });
    ctx.status = error instanceof EvaluationError ? 400 : 503;
    ctx.body = `Failed to fetch contract interactions for contract: ${contractTxId}. ${message}`;
  }
  return next();
}

export async function contractFieldHandler(ctx: KoaContext, next: Next) {
  const { contractTxId, field } = ctx.params;
  const { logger, warp } = ctx.state;
  try {
    logger.debug('Fetching contract field', {
      contractTxId,
      field,
    });
    const { state, evaluationOptions } = await getContractState({
      contractTxId,
      warp,
    });
    const contractField = state[field];

    if (!contractField) {
      ctx.status = 404;
      ctx.body = 'Contract field not found';
      return next();
    }

    ctx.body = {
      contractTxId,
      [field]: contractField,
      evaluationOptions,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error.';
    logger.error('Fetching contract field', {
      contractTxId,
      field,
      error: message,
    });
    ctx.status = error instanceof EvaluationError ? 400 : 503;
    ctx.body = `Failed to fetch contract: ${contractTxId}`;
  }
  return next();
}

export async function contractBalanceHandler(ctx: KoaContext, next: Next) {
  const { contractTxId, address } = ctx.params;
  const { logger, warp } = ctx.state;
  try {
    logger.debug('Fetching contract balance for wallet', {
      contractTxId,
      wallet: address,
    });
    const { state, evaluationOptions } = await getContractState({
      contractTxId,
      warp,
    });
    const balance = state['balances'][address];

    ctx.body = {
      contractTxId,
      address,
      balance: balance ?? 0,
      evaluationOptions,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error.';
    logger.error('Failed to fetch balance.', {
      contractTxId,
      wallet: address,
      error: message,
    });
    ctx.status = error instanceof EvaluationError ? 400 : 503;
    ctx.body = `Failed to fetch balance for wallet ${address}. ${message}`;
  }

  return next();
}

export async function contractRecordHandler(ctx: KoaContext, next: Next) {
  const { contractTxId, name } = ctx.params;
  const { warp, logger: _logger } = ctx.state;

  const logger = _logger.child({
    contractTxId,
    record: name,
  });

  try {
    logger.debug('Fetching contract record');
    const { state, evaluationOptions } = await getContractState({
      contractTxId,
      warp,
    });
    const record = state['records'][name];

    if (!record) {
      ctx.status = 404;
      ctx.message = 'Record not found';
      return next();
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
        // don't set evaluation options for sub contracts - they'll be pulled on load
      });
      response['owner'] = antContract?.owner;
      response['evaluationOptions'] = evaluationOptions;
    }

    ctx.body = response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error.';
    logger.error('Failed to fetch contract record', {
      error: message,
    });
    ctx.status = error instanceof EvaluationError ? 400 : 503;
    ctx.body = `Failed to fetch record. ${message}`;
  }
  return next();
}

export async function contractReservedHandler(ctx: KoaContext, next: Next) {
  const { contractTxId, name } = ctx.params;
  const { warp, logger: _logger } = ctx.state;

  const logger = _logger.child({
    contractTxId,
    record: name,
  });

  try {
    const { state, evaluationOptions } = await getContractState({
      contractTxId,
      warp,
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error.';
    logger.error('Failed to determine if record is reserved.', {
      error: message,
    });
    ctx.status = error instanceof EvaluationError ? 400 : 503;
    ctx.body = `Failed to determine if record is reserved. ${message}`;
  }
  return next();
}
