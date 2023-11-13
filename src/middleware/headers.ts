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
import { KoaContext } from '../types';

const MAX_AGE_SECONDS = process.env.MAX_AGE_SECONDS ?? 30;

export async function headersMiddleware(ctx: KoaContext, next: Next) {
  const { logger } = ctx.state;
  await next();
  if (ctx.status > 299) {
    // don't set cache if we got a bad response
    logger.debug('Setting cache-control to no-cache.');
    ctx.set('Cache-Control', 'no-cache');
  } else {
    logger.debug(`Setting cache-control to max-age=${MAX_AGE_SECONDS}.`);
    // add header at the end of all successful requests
    ctx.set('Cache-Control', `max-age=${MAX_AGE_SECONDS}`);
  }
}
