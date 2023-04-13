import { Next } from "koa";

import { KoaContext } from "../types";
import { getContractState } from "../api/warp";

export async function contractHandler(ctx: KoaContext, next: Next) {
  const { id } = ctx.params;
  try {
    const warp = ctx.state.warp;
    const state = await getContractState(id, warp);
    ctx.body = state;
  } catch (error){
    ctx.status = 503;
    ctx.body = `Failed to fetch contract: ${id}`
  }
  return next;
}
