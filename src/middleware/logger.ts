/**
 * Copyright (C) 2022-2024 Permanent Data Solutions, Inc. All Rights Reserved.
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
import { KoaContext } from '../types.js';
import { Next } from 'koa';
import crypto from 'crypto';
import logger from '../logger';

export async function loggerMiddleware(ctx: KoaContext, next: Next) {
  const trace = crypto.randomUUID().substring(0, 6);
  const log = logger.child({
    trace,
    path: ctx.path,
    method: ctx.method,
    params: ctx.params,
  });
  ctx.state.logger = log;
  ctx.state.trace = trace;
  const startTime = Date.now();
  await next();
  const duration = Date.now() - startTime;
  log.debug('Completed request.', {
    responseTime: `${duration}ms`,
  });
}
