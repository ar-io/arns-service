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

import { getContractState } from './api/warp';
import { prefetchContractTxIds } from './config';
import logger from './logger';
import { warp } from './middleware';

let successfullyPrefetchedContracts = false;
const prefetchRequired = process.env.PREFETCH_CONTRACTS === 'true';
export const getPrefetchStatusCode = () => {
  if (!prefetchRequired) {
    return 200;
  }
  return successfullyPrefetchedContracts ? 200 : 503;
};

export const prefetchContracts = async () => {
  if (!prefetchRequired) {
    logger.info('Skipping pre-fetching contracts');
    return;
  }

  // don't wait - just fire and forget
  const prefetchResults = await Promise.all(
    prefetchContractTxIds.map((contractTxId: string) => {
      const startTimestamp = Date.now();
      logger.info('Pre-fetching contract state...', {
        contractTxId,
        startTimestamp,
      });
      return getContractState({
        contractTxId,
        warp,
        logger: logger.child({ prefetch: true }),
      })
        .then(() => {
          const endTimestamp = Date.now();
          logger.info('Successfully prefetched contract state', {
            contractTxId,
            startTimestamp,
            endTimestamp,
            durationMs: endTimestamp - startTimestamp,
          });
          return true;
        })
        .catch((error: unknown) => {
          const endTimestamp = Date.now();
          const message = error instanceof Error ? error.message : error;
          logger.error('Failed to prefetch contract state', {
            error: message,
            contractTxId,
            startTimestamp,
            endTimestamp,
            durationMs: endTimestamp - startTimestamp,
          });
          // don't fail the entire prefetch operation if one contract fails
          return true;
        });
    }),
  ).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : error;
    logger.error('Failed to prefetch contract state', {
      error: message,
      contractTxIds: prefetchContractTxIds,
    });
    // fail if anything throws
    return [false];
  });
  // update our healthcheck flag
  successfullyPrefetchedContracts = prefetchResults.every(
    (result) => result === true,
  );
  logger.info('Finished pre-fetching contracts', {
    success: successfullyPrefetchedContracts,
    contractTxIds: prefetchContractTxIds,
  });
};
