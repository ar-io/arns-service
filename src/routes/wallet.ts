import { Next } from "koa";
import { KoaContext } from "../types";
import {
  getContractsTransferredToOrControlledByWallet,
  getDeployedContractsByWallet,
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
      ctx.body = `Invalid type. Must be one of ${allowedContractTypes.join(
        ","
      )}.`;
      ctx.status = 400;
      return next();
    }

    logger.debug("Fetching deployed contracts for wallet.", {
      address,
    });

    const [{ ids: deployedContractIds }, { ids: controlledOrOwnedIds }] =
      await Promise.all([
        getDeployedContractsByWallet(arweave, { address }),
        getContractsTransferredToOrControlledByWallet(arweave, { address }),
      ]);

    // merge them
    const deployedOrOwned = new Set([
      ...deployedContractIds,
      ...controlledOrOwnedIds,
    ]);

    // validate the schema based on the type
    logger.info(
      "Filtering contracts state that match provided type and are owned or controlled by provided wallet.",
      {
        type,
        contractIds: deployedOrOwned,
        address,
      }
    );

    // NOTE: this may take a long time since it must evaluate all contract states.
    // We use a wrapper to limit the amount of time evaluating each contract.
    // This will basically cap the total amount of time we'll evaluate states before
    // returning.
    const startTime = Date.now();
    const validContractsOfType = (
      await Promise.allSettled(
        [...deployedOrOwned].map(async (id: string) =>
          (await validateStateWithTimeout(id, warp, type, address)) ? id : null
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    logger.error("Failed to fetch contracts for wallet", {
      address,
      error: message,
    });
    ctx.status = 503;
    ctx.body = `Failed to fetch contracts for wallet. ${message}`;
  }
  return next();
}
