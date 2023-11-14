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
import { KoaContext } from '../types';
import { Next } from 'koa';
import { BadRequestError, EvaluationError, NotFoundError } from '../errors';

// globally handle errors and return proper status based on their type
export async function errorMiddleware(ctx: KoaContext, next: Next) {
  const { logger } = ctx.state;
  try {
    await next();
  } catch (error) {
    logger.error('Error processing request.', {
      error: error instanceof Error ? error.message : error,
    });
    if (error instanceof EvaluationError || error instanceof BadRequestError) {
      ctx.status = 400;
      ctx.body = error.message;
    } else if (error instanceof NotFoundError) {
      ctx.status = 404;
      ctx.body = error.message;
    } else {
      // log full stack trace when 503s are returned to client to help with debugging
      logger.error('Unknown error returned to client.', error);
      ctx.status = 503;
      ctx.body = 'Internal server error.';
    }
  }
}
