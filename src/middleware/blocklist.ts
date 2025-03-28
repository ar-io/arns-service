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
import { Next } from 'koa';
import { BLOCKLISTED_CONTRACT_IDS } from '../constants';
import { KoaContext } from '../types';
import logger from '../logger';
import { blockListedContractCount } from '../metrics';

export async function blocklistMiddleware(ctx: KoaContext, next: Next) {
  const { contractTxId } = ctx.params;
  if (BLOCKLISTED_CONTRACT_IDS.has(contractTxId)) {
    blockListedContractCount
      .labels({
        contractTxId,
      })
      .inc();
    logger.debug('Blocking contract evaluation', {
      contractTxId,
    });
    ctx.status = 403;
    ctx.message = 'Contract is blocklisted.';
    return;
  }

  return next();
}
