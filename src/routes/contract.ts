import { Next } from "koa";

import { KoaContext } from "../types";
import { getContractState } from "../api/warp";


export async function contractHandler(ctx: KoaContext, next: Next) {
  const { id } = ctx.params;
  try {
    const warp = ctx.state.warp;
    const state = await getContractState(id, warp);
    ctx.body = {
      contract: id,
      state
    };
  } catch (error){
    ctx.status = 503;
    ctx.body = `Failed to fetch contract: ${id}`
  }
  return next;
}

export async function contractFieldHandler(ctx:KoaContext, next: Next){
  const { id, field } = ctx.params;
  try {
    const warp = ctx.state.warp;
    const state = await getContractState(id, warp);
    const contractField = state[field];

    if(!contractField){
      ctx.status = 404;
      ctx.body = 'Contract field not found'
      return next;
    }

    ctx.body = {
      contract: id,
      [field]: contractField
    }
  } catch (error){
    ctx.status = 503;
    ctx.body = `Failed to fetch contract: ${id}`
  }
  return next;
}

export async function contractBalanceHandler(ctx: KoaContext, next: Next){
  const { id, address } = ctx.params;
  try {
    const warp = ctx.state.warp;
    const state = await getContractState(id, warp);
    const balance = state["balances"][address];
    
    if(!balance){
      ctx.body = 404;
      ctx.status = 404;
      ctx.body = 'Wallet address not found'
      return next;
    }

    ctx.body = {
      contract: id,
      address,
      balance
    };
  } catch (error){
    ctx.status = 503;
    ctx.body = `Failed to fetch balance.`
  }
  return next;
}

export async function contractRecordHandler(ctx: KoaContext, next: Next){
  const { id, name } = ctx.params;
  try {
    const warp = ctx.state.warp;
    const state = await getContractState(id, warp);
    const record = state['records'][name];

    if(!record){
      ctx.status = 404;
      ctx.message = 'Record not found'
      return next;
    }

    ctx.body = {
      contract: id,
      name,
      record: record
    };
  } catch (error: any){
    ctx.status = 503;
    ctx.body = `Failed to fetch record.`
  }
  return next;
}
