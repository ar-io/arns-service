import { Next } from 'koa';
import { KoaContext } from '../types.js';
import {
  LogLevel,
  LoggerFactory,
  WarpFactory,
  defaultCacheOptions,
} from 'warp-contracts';
import { arweave } from './arweave';
import { LmdbCache } from 'warp-contracts-lmdb';

LoggerFactory.INST.logLevel(
  (process.env.WARP_LOG_LEVEL as LogLevel) ?? 'fatal',
);

/**
 * TODO: consider using warp-contracts-postgres cache for distribution caching (or EFS with warp-contracts-lmdb or warp-contracts-sqlite)
 */
const warp = WarpFactory.forMainnet(
  {
    ...defaultCacheOptions,
  },
  true,
  arweave,
).useStateCache(new LmdbCache(defaultCacheOptions));

export function warpMiddleware(ctx: KoaContext, next: Next) {
  ctx.state.warp = warp;
  return next();
}
