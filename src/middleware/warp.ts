import { Next } from "koa";
import { KoaContext } from "../types.js";
import { LogLevel, LoggerFactory, WarpFactory, defaultCacheOptions } from "warp-contracts";
import { LmdbCache } from "warp-contracts-lmdb";

export default function warpMiddleware(ctx: KoaContext, next: Next){
    LoggerFactory.INST.logLevel(process.env.WARP_LOG_LEVEL as LogLevel ?? 'fatal');
    const warp = WarpFactory.forMainnet()
    .useStateCache(
      new LmdbCache({...defaultCacheOptions,})
    ).useContractCache(
      // Contract cache
      new LmdbCache({...defaultCacheOptions}), 
      // Source cache
      new LmdbCache({...defaultCacheOptions})
    );
    ctx.state.warp = warp;
    return next();
}
