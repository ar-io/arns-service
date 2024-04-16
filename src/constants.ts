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
import { EvaluationOptions } from 'warp-contracts';

export const PREFETCH_CONTRACTS = process.env.PREFETCH_CONTRACTS === 'true';
export const BOOTSTRAP_CACHE = process.env.BOOTSTRAP_CACHE === 'true';
export const SAVE_CACHE_TO_S3 = process.env.SAVE_CACHE_TO_S3 === 'true';
export const BLOCKLISTED_CONTRACT_IDS = new Set(
  process.env.BLOCKLISTED_CONTRACT_IDS
    ? process.env.BLOCKLISTED_CONTRACT_IDS.split(',')
    : ['fbU8Y4NMKKzP4rmAYeYj6tDrVDo9XNbdyq5IZPA31WQ'],
);
export const MAX_PATH_DEPTH = 5;
export const ARWEAVE_TX_ID_REGEX = '([a-zA-Z0-9-_s+]{43})';
export const ARNS_NAME_REGEX = '([a-zA-Z0-9-s+]{1,51})';
export const SUB_CONTRACT_EVALUATION_TIMEOUT_MS = 10_000; // 10 sec state timeout - non configurable
export const DEFAULT_REQUEST_TIMEOUT_MS = 180_000;
export const DEFAULT_STATE_EVALUATION_TIMEOUT_MS = +(
  process.env.EVALUATION_TIMEOUT_MS || DEFAULT_REQUEST_TIMEOUT_MS
); // 3 min state timeout (should be <= koa request timeout)
export const allowedContractTypes = ['ant'] as const;
export const DEFAULT_PAGES_PER_BATCH = +(
  process.env.EVALUATION_PAGES_PER_BATCH || 100
); // loads 5k interactions at a time
export const DEFAULT_EVALUATION_OPTIONS: Partial<EvaluationOptions> &
  Required<Pick<EvaluationOptions, 'maxInteractionEvaluationTimeSeconds'>> = {
  maxInteractionEvaluationTimeSeconds: 3600, // one hour
};
