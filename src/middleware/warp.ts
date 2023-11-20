/**
 * Copyright (C) 2022-2023 Permanent Data Solutions, Inc. All Rights Reserved.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
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
).useStateCache(
  new LmdbCache(
    {
      ...defaultCacheOptions,
      inMemory: false,
    },
    {
      maxEntriesPerContract: 1000,
      minEntriesPerContract: 0,
    },
  ),
);

export function warpMiddleware(ctx: KoaContext, next: Next) {
  ctx.state.warp = warp;
  return next();
}
