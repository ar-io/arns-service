import { Next } from "koa";

import { ContractRecordResponse, KoaContext } from "../types";
import {
  DEFAULT_EVALUATION_OPTIONS,
  EvaluationError,
  getContractState,
} from "../api/warp";
import { getWalletInteractionsForContract } from "../api/graphql";
import { EvaluationOptions } from "warp-contracts";

// Small util to parse evaluation options query params - we may want to use a library to help with this for other types
export function decodeQueryParams(
  evalOptions: any
): Partial<EvaluationOptions> & any {
  return Object.entries(evalOptions).reduce(
    (decodedEvalOptions: any, [key, value]: [string, any]) => {
      if (value === "true" || value === "false") {
        decodedEvalOptions[key] = value === "true";
        return decodedEvalOptions;
      }
      // TODO: we may need to convert other types of values
      decodedEvalOptions[key] = value;
      return decodedEvalOptions;
    },
    {}
  );
}

export async function contractHandler(ctx: KoaContext, next: Next) {
  const { logger, warp } = ctx.state;
  const { id } = ctx.params;
  // query params can be set for contracts with various eval options
  const evaluationOptions = ctx.request.querystring
    ? decodeQueryParams(ctx.request.query)
    : DEFAULT_EVALUATION_OPTIONS;
  try {
    logger.debug("Fetching contract state", { id, evaluationOptions });
    const { state } = await getContractState({ id, warp, evaluationOptions });
    ctx.body = {
      contract: id,
      state,
      evaluationOptions,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    logger.error("Failed to fetch contract", {
      id,
      error: message,
      evaluationOptions,
    });
    ctx.status = 503;
    ctx.body = `Failed to fetch contract: ${id}. ${message}`;
  }
  return next();
}

export async function contractInteractionsHandler(ctx: KoaContext, next: Next) {
  const { arweave, logger, warp } = ctx.state;
  const { id, address } = ctx.params;
  const evaluationOptions = ctx.request.querystring
    ? decodeQueryParams(ctx.request.query)
    : DEFAULT_EVALUATION_OPTIONS;

  try {
    logger.debug("Fetching all contract interactions", {
      id,
      evaluationOptions,
    });
    const [{ validity, errorMessages }, { interactions }] = await Promise.all([
      getContractState({ id, warp, evaluationOptions }),
      getWalletInteractionsForContract(arweave, {
        address: address,
        contractId: id,
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
      contract: id,
      interactions: mappedInteractions,
      ...(address ? { address } : {}), // only include address if it was provided
      evaluationOptions,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    logger.error("Failed to fetch contract interactions.", {
      id,
      error: message,
    });
    ctx.status = 503;
    ctx.body = `Failed to fetch contract interactions for contract: ${id}. ${message}`;
  }
  return next();
}

export async function contractFieldHandler(ctx: KoaContext, next: Next) {
  const { id, field } = ctx.params;
  const { logger, warp } = ctx.state;
  const evaluationOptions = ctx.request.querystring
    ? decodeQueryParams(ctx.request.query)
    : DEFAULT_EVALUATION_OPTIONS;
  try {
    logger.debug("Fetching contract field", { id, field, evaluationOptions });
    const { state } = await getContractState({ id, warp, evaluationOptions });
    const contractField = state[field];

    if (!contractField) {
      ctx.status = 404;
      ctx.body = "Contract field not found";
      return next();
    }

    ctx.body = {
      contract: id,
      [field]: contractField,
      evaluationOptions,
    };
  } catch (error) {
    logger.error("Fetching contract field", { id, field, error });
    ctx.status = 503;
    ctx.body = `Failed to fetch contract: ${id}`;
  }
  return next();
}

export async function contractBalanceHandler(ctx: KoaContext, next: Next) {
  const { id, address } = ctx.params;
  const { logger, warp } = ctx.state;
  // query params can be set for contracts with various eval options
  const evaluationOptions = ctx.request.querystring
    ? decodeQueryParams(ctx.request.query)
    : DEFAULT_EVALUATION_OPTIONS;
  try {
    logger.debug("Fetching contract balance for wallet", {
      id,
      wallet: address,
      evaluationOptions,
    });
    const { state } = await getContractState({ id, warp, evaluationOptions });
    const balance = state["balances"][address];

    ctx.body = {
      contract: id,
      address,
      balance: balance ?? 0,
      evaluationOptions,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    logger.error("Failed to fetch balance.", {
      id,
      wallet: address,
      error: message,
    });
    ctx.status = 503;
    ctx.body = `Failed to fetch balance for wallet ${address}. ${message}`;
  }
  return next();
}

export async function contractRecordHandler(ctx: KoaContext, next: Next) {
  const { id, name } = ctx.params;
  const { warp } = ctx.state;
  const logger = ctx.state.logger.child({
    id,
    record: name,
  });
  const evaluationOptions = ctx.request.querystring
    ? decodeQueryParams(ctx.request.query)
    : DEFAULT_EVALUATION_OPTIONS;

  try {
    logger.debug("Fetching contract record", {
      id,
      name,
      evaluationOptions,
    });
    const { state } = await getContractState({ id, warp, evaluationOptions });
    const record = state["records"][name];

    if (!record) {
      ctx.status = 404;
      ctx.message = "Record not found";
      return next();
    }

    const response: ContractRecordResponse = {
      contract: id,
      name,
      record,
      evaluationOptions,
    };

    // get record details and contract state if it's from the source contract
    if (record.contractTxId) {
      logger.info("Fetching owner of record name", {
        contractTxId: record.contractTxId,
      });
      const { state: antContract } = await getContractState({
        id: record.contractTxId,
        warp,
        // TODO: ant contracts likely have different evaluation options - for now set defaults
        evaluationOptions: DEFAULT_EVALUATION_OPTIONS,
      });
      response["owner"] = antContract?.owner;
    }

    ctx.body = response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    logger.error("Failed to fetch contract record", {
      id,
      record: name,
      error: message,
    });
    if (error instanceof EvaluationError) {
      ctx.status = 400;
    } else {
      ctx.status = 503;
    }
    ctx.body = `Failed to fetch record. ${message}`;
  }
  return next();
}
