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
import logger from '../logger';
import { BadRequestError } from '../errors';

const WARP_SORT_KEY_REGEX = /^[0-9]{12},[0-9]{13},[0-9a-fA-F]{64}$/;
export const queryMiddleware = async (ctx: KoaContext, next: Next) => {
  const { blockHeight, sortKey } = ctx.query;

  if (blockHeight && sortKey) {
    throw new BadRequestError(
      'Must provide either block height and sort key. You cannot provide both.',
    );
  }

  if (blockHeight) {
    if (isNaN(+blockHeight)) {
      logger.debug('Invalid block height provided', { blockHeight });
      throw new BadRequestError(
        'Invalid block height, must be a single integer',
      );
    }
    logger.info('Block height provided via query param', { blockHeight });
    ctx.state.blockHeight = +blockHeight;
  }

  if (sortKey) {
    if (Array.isArray(sortKey) || !WARP_SORT_KEY_REGEX.test(sortKey)) {
      logger.debug('Invalid sort key provided', { sortKey });
      throw new BadRequestError(
        `Invalid sort key, must be a single string and match ${WARP_SORT_KEY_REGEX}`,
      );
    }
    logger.info('Sort key provided via query param', { sortKey });
    ctx.state.sortKey = sortKey;
  }

  return next();
};
