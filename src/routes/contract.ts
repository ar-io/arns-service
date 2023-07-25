import { Next } from 'koa';

import { ContractRecordResponse, KoaContext } from '../types';
import {
  DEFAULT_EVALUATION_OPTIONS,
  EvaluationError,
  getContractState,
} from '../api/warp';
import { getWalletInteractionsForContract } from '../api/graphql';
import { EvaluationOptions } from 'warp-contracts';
import { ParsedUrlQuery } from 'querystring';

// Small util to parse evaluation options query params - we may want to use a library to help with this for other types
export function decodeQueryParams(
  evalOptions: ParsedUrlQuery,
): Partial<EvaluationOptions> & unknown {
  return Object.entries(evalOptions).reduce(
    (
      decodedEvalOptions: {
        [key: string]: string | boolean;
      },
      [key, value]: [string, any], // eslint-disable-line
    ) => {
      let parsedValue = value;
      // take only the first value if provided an array
      if (Array.isArray(value)) {
        parsedValue = value[0]; // take the first one
      }
      if (parsedValue === 'true' || parsedValue === 'false') {
        parsedValue = parsedValue === 'true'; // convert it to a boolean type
      }
      decodedEvalOptions[key] = parsedValue;
      return decodedEvalOptions;
    },
    {},
  );
}

export async function contractHandler(ctx: KoaContext, next: Next) {
  const { logger, warp } = ctx.state;
  const { contractTxId } = ctx.params;
  // query params can be set for contracts with various eval options
  const evaluationOptions = ctx.request.querystring
    ? decodeQueryParams(ctx.request.query)
    : DEFAULT_EVALUATION_OPTIONS;
  try {
    logger.debug('Fetching contract state', {
      contractTxId,
      evaluationOptions,
    });
    const { state } = await getContractState({
      contractTxId,
      warp,
      evaluationOptions,
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
      evaluationOptions,
    });
    ctx.status = error instanceof EvaluationError ? 400 : 503;
    ctx.body = `Failed to fetch contract: ${contractTxId}. ${message}`;
  }

  return next();
}

export async function contractInteractionsHandler(ctx: KoaContext, next: Next) {
  const { arweave, logger, warp } = ctx.state;
  const { contractTxId, address } = ctx.params;
  const evaluationOptions = ctx.request.querystring
    ? decodeQueryParams(ctx.request.query)
    : DEFAULT_EVALUATION_OPTIONS;

  try {
    logger.debug('Fetching all contract interactions', {
      contractTxId,
      evaluationOptions,
    });
    const [{ validity, errorMessages }, { interactions }] = await Promise.all([
      getContractState({ contractTxId, warp, evaluationOptions }),
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
  const evaluationOptions = ctx.request.querystring
    ? decodeQueryParams(ctx.request.query)
    : DEFAULT_EVALUATION_OPTIONS;
  try {
    logger.debug('Fetching contract field', {
      contractTxId,
      field,
      evaluationOptions,
    });
    const { state } = await getContractState({
      contractTxId,
      warp,
      evaluationOptions,
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
  // query params can be set for contracts with various eval options
  const evaluationOptions = ctx.request.querystring
    ? decodeQueryParams(ctx.request.query)
    : DEFAULT_EVALUATION_OPTIONS;
  try {
    logger.debug('Fetching contract balance for wallet', {
      contractTxId,
      wallet: address,
      evaluationOptions,
    });
    const { state } = await getContractState({
      contractTxId,
      warp,
      evaluationOptions,
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
  const evaluationOptions = ctx.request.querystring
    ? decodeQueryParams(ctx.request.query)
    : DEFAULT_EVALUATION_OPTIONS;

  const logger = _logger.child({
    contractTxId,
    record: name,
    evaluationOptions,
  });

  try {
    logger.debug('Fetching contract record');
    const { state } = await getContractState({
      contractTxId,
      warp,
      evaluationOptions,
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
      const { state: antContract } = await getContractState({
        contractTxId: record.contractTxId,
        warp,
        // TODO: ant contracts likely have different evaluation options - for now set defaults
        evaluationOptions: DEFAULT_EVALUATION_OPTIONS,
      });
      response['owner'] = antContract?.owner;
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
