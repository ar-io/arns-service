import { Next } from "koa";

import { KoaContext } from "../types";
import { Warp } from "warp-contracts";

export async function contractHandler(ctx: KoaContext, next: Next) {
  const warp = ctx.state.warp as Warp;
  const { id } = ctx.params;
  try {
    const contract = warp.contract(id);
    const { cachedValue } = await contract.readState();
    ctx.body = cachedValue.state;
  } catch (error){
    ctx.status = 503;
    ctx.body = `Failed to fetch contract: ${id}`
  }
  return next;
}
