import { Next } from "koa";

import { KoaContext } from "../types";
import { Warp } from "warp-contracts";

const requestMap: Map<string, Promise<any> | undefined> = new Map();

export async function contractHandler(ctx: KoaContext, next: Next) {
  const { id } = ctx.params;
  try {
    // validate request is new, if not return the existing promise (e.g. barrier synchronization)
    if(requestMap.get(id)){
      const cachedValue = await requestMap.get(id);
      ctx.body = cachedValue;
      return next;
    }

    const warp = ctx.state.warp as Warp;
    const contract = warp.contract(id);
    // set cached value for multiple requests during initial promise
    requestMap.set(id, contract.readState());
    // await the response
    const { cachedValue } = await requestMap.get(id);
    ctx.body = cachedValue.state;
  } catch (error){
    ctx.status = 503;
    ctx.body = `Failed to fetch contract: ${id}`
  } finally {
    // clean up the promise
    requestMap.delete(id);
  }

  return next;
}
