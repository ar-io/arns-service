import { Next } from "koa";
import { KoaContext } from "../types.js";
import { LogLevel, LoggerFactory, WarpFactory, defaultCacheOptions } from "warp-contracts";
import { LmdbCache } from "warp-contracts-lmdb";

LoggerFactory.INST.logLevel(process.env.WARP_LOG_LEVEL as LogLevel ?? 'fatal');

export function warpMiddleware(ctx: KoaContext, next: Next){
    // TODO: could be added to koa context state
    const { arweave } = ctx.state;
    
    // TODO: setting useArweaveGw to true shows error
    const warp = WarpFactory.forMainnet(defaultCacheOptions, false, arweave)
    .useStateCache(
      new LmdbCache(defaultCacheOptions)
    ).useContractCache(
      // Contract cache
      new LmdbCache(defaultCacheOptions), 
      // Source cache
      new LmdbCache(defaultCacheOptions)
    );
    ctx.state.warp = warp;
    return next();
}
