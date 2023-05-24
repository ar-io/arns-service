import { Next } from "koa";
import { KoaContext } from "../types";
import {
  getDeployedContractsForWallet,
  getWalletInteractionsForContract,
} from "../api/graphql";
import { isValidContractType, validateStateWithTimeout } from "../api/warp";
import { allowedContractTypes } from "../constants";
import * as _ from "lodash";

export async function walletContractHandler(ctx: KoaContext, next: Next) {
  const { address } = ctx.params;
  const { logger, arweave, warp } = ctx.state;
  const { query } = ctx.request;
  const { type } = query;

  try {
    // validate type is empty or valid
    if (!isValidContractType(type)) {
      throw Error(
        `Invalid type. Must be one of ${allowedContractTypes.join(",")}.`
      );
    }

    logger.debug("Fetching deployed contracts for wallet.", {
      address,
    });

    const { ids: contractIds } = await getDeployedContractsForWallet(arweave, {
      address,
    });

    // return all contract IDs without evaluating state
    if (!type) {
      ctx.body = {
        address,
        contractIds,
      };
      return next;
    }

    // validate the schema based on the type
    logger.info("Filtering contracts state that match provided type.", {
      type,
    });

    // NOTE: this may take a long time since it must evaluate all contract states.
    // We use a wrapper to limit the amount of time evaluating each contract.
    // This will basically cap the total amount of time we'll evaluate states before
    // returning.
    const startTime = Date.now();
    const validContractsOfType = (
      await Promise.allSettled(
        contractIds.map(async (id) =>
          (await validateStateWithTimeout(id, warp, type)) ? id : null
        )
      )
    ).map((i) => (i.status === "fulfilled" ? i.value : null));
    logger.info(`Finished evaluating contracts.`, {
      duration: `${Date.now() - startTime}ms`,
      type,
    });
    ctx.body = {
      address,
      contractIds: _.compact(validContractsOfType),
      type,
    };
  } catch (error: any) {
    logger.error("Failed to fetch contracts for wallet", { address, error });
    ctx.status = 503;
    ctx.body = error.message ?? "Failed to fetch contracts for wallet.";
  }
  return next;
}

export async function walletInteractionHandler(ctx: KoaContext, next: Next) {
  const { address, id } = ctx.params;
  const { logger, arweave } = ctx.state;

  try {
    logger.debug("Fetching wallet interactions for contract.", {
      address,
      contractId: id,
    });
    const { interactions } = await getWalletInteractionsForContract(arweave, {
      address,
      contractId: id,
    });
    ctx.body = {
      address,
      contractId: id,
      interactions: Object.fromEntries(interactions),
    };
  } catch (error) {
    logger.error("Failed to fetch interactions on contract for wallet", {
      address,
      contractId: id,
      error,
    });
    ctx.status = 503;
    ctx.body = "Failed to fetch interactions on contract for wallet.";
  }
  return next;
}
