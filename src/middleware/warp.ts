import { Next } from "koa";
import { KoaContext } from "../types.js";
import {
  LogLevel,
  LoggerFactory,
  WarpFactory,
  defaultCacheOptions,
} from "warp-contracts";

LoggerFactory.INST.logLevel(
  (process.env.WARP_LOG_LEVEL as LogLevel) ?? "fatal"
);

export function warpMiddleware(ctx: KoaContext, next: Next) {
  const { arweave } = ctx.state;

  /**
     * TODO: ContractDefinitionsLoader does not have cache implemented when using custom arweave config, so use inMemory for now. Once it is updated, we should revert back to LMDB cache implementation.
     * 
     * Reference: https://github.com/warp-contracts/warp/blob/cde7b07f9495f09e998b13d1fe2661b0af0a3b74/src/core/modules/impl/ContractDefinitionLoader.ts#L150-L165
     * e.g. 
        const warp = WarpFactory.forMainnet(defaultCacheOptions, true, arweave)
        .useStateCache(
            new LmdbCache(defaultCacheOptions)
        ).useContractCache(
            // Contract cache
            new LmdbCache(defaultCacheOptions), 
            // Source cache
            new LmdbCache(defaultCacheOptions)
        );
     */
  const warp = WarpFactory.forMainnet(
    {
      ...defaultCacheOptions,
      inMemory: true,
    },
    true,
    arweave
  );
  ctx.state.warp = warp;
  return next();
}
