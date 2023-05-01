import { Next } from "koa";

import { KoaContext } from "../types";
import { getContractState } from "../api/warp";

export async function contractHandler(ctx: KoaContext, next: Next) {
  const { logger, warp } = ctx.state;
  const { id } = ctx.params;

  try {
    logger.debug('Fetching contract state', { id })
    const state = await getContractState(id, warp);
    ctx.body = {
      contract: id,
      state
    };
  } catch (error){
    logger.error('Failed to fetch contract', { id })
    ctx.status = 503;
    ctx.body = `Failed to fetch contract: ${id}`
  }
  return next;
}

export async function contractFieldHandler(ctx:KoaContext, next: Next){
  const { id, field } = ctx.params;
  const { logger, warp } = ctx.state;
  try {
    logger.debug('Fetching contract field', { id, field })
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
    logger.error('Fetching contract field', { id, field, error })
    ctx.status = 503;
    ctx.body = `Failed to fetch contract: ${id}`
  }
  return next;
}

export async function contractBalanceHandler(ctx: KoaContext, next: Next){
  const { id, address } = ctx.params;
  const { logger, warp } = ctx.state;
  try {
    logger.debug('Fetching contract balance for wallet', { id, wallet: address })
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
    logger.error('Failed to fetch balance.', { id, wallet: address, error })
    ctx.status = 503;
    ctx.body = `Failed to fetch balance.`
  }
  return next;
}

export async function contractRecordHandler(ctx: KoaContext, next: Next){
  const { id, name } = ctx.params;
  const { logger, warp } = ctx.state;

  try {
    logger.debug('Fetching contract record', { id, record: name })
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
    logger.error('Failed to fetch contract record', { id, record: name, error })
    ctx.status = 503;
    ctx.body = `Failed to fetch record.`
  }
  return next;
}
