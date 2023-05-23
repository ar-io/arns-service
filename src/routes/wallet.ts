import { Next } from "koa";
import { KoaContext } from "../types";
import {
  getDeployedContractsForWallet,
  getWalletInteractionsForContract,
} from "../api/graphql";

export async function walletContractHandler(ctx: KoaContext, next: Next) {
  const { address } = ctx.params;
  const { logger, arweave } = ctx.state;

  try {
    logger.debug("Fetching deployed contracts for wallet.", {
      address,
    });
    const { ids: contractIds } = await getDeployedContractsForWallet(arweave, {
      address,
    });
    ctx.body = {
      address,
      contractIds,
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
    console.log(error);
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
