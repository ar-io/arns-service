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

import { KoaContext } from '../types';
import {
  getContractsTransferredToOrControlledByWallet,
  getDeployedContractsByWallet,
} from '../api/graphql';
import { isValidContractType, validateStateAndOwnership } from '../api/warp';
import {
  BLOCKLISTED_CONTRACT_IDS,
  DEFAULT_STATE_EVALUATION_TIMEOUT_MS,
  allowedContractTypes,
} from '../constants';
import * as _ from 'lodash';
import { BadRequestError } from '../errors';
import { blockListedContractCount } from '../metrics';
import pLimit from 'p-limit';

const CONCURRENT_CONTRACT_EVALUATION_LIMIT = 10;
export async function walletContractHandler(ctx: KoaContext) {
  const { address } = ctx.params;
  const { logger, arweave, warp } = ctx.state;
  const { type } = ctx.query;

  // validate type is empty or valid
  if (!isValidContractType(type)) {
    throw new BadRequestError(
      `Invalid type. Must be one of ${allowedContractTypes.join(',')}.`,
    );
  }

  logger.debug('Fetching deployed contracts for wallet.', {
    address,
  });

  // synchronize our abort signals
  const abortSignal = AbortSignal.timeout(DEFAULT_STATE_EVALUATION_TIMEOUT_MS);
  const [{ ids: deployedContractTxIds }, { ids: controlledOrOwnedIds }] =
    await Promise.all([
      getDeployedContractsByWallet(arweave, { address }, abortSignal),
      getContractsTransferredToOrControlledByWallet(
        arweave,
        { address },
        abortSignal,
      ),
    ]);

  // merge them
  const deployedOrOwned = new Set([
    ...deployedContractTxIds,
    ...controlledOrOwnedIds,
  ]);

  // validate the schema based on the type
  logger.info(
    'Filtering contracts state that match provided type and are owned or controlled by provided wallet.',
    {
      type,
      contractTxIds: deployedOrOwned,
      address,
    },
  );

  // this may take a long time since it must evaluate all contract states so we provide the abort signal used above to timeout if the request takes too long
  const startTime = Date.now();
  const parallelLimit = pLimit(CONCURRENT_CONTRACT_EVALUATION_LIMIT);
  const validContractsOfType = (
    await Promise.allSettled(
      [...deployedOrOwned].map(async (id: string) => {
        return parallelLimit(() => {
          // do not evaluate any blocklisted contracts
          if (BLOCKLISTED_CONTRACT_IDS.has(id)) {
            logger.debug('Skipping blocklisted contract.', {
              contractTxId: id,
            });
            blockListedContractCount
              .labels({
                contractTxId: id,
              })
              .inc();
            return null;
          }

          // do not pass any evaluation options, the contract manifests will be fetched for each of these so they properly evaluate
          return validateStateAndOwnership({
            contractTxId: id,
            warp,
            type,
            address,
            logger,
            signal: abortSignal,
          }).then((result: boolean) => (result ? id : null));
        });
      }),
    )
  ).map((i) => (i.status === 'fulfilled' ? i.value : null));
  logger.info(`Finished evaluating contracts.`, {
    duration: `${Date.now() - startTime}ms`,
    type,
  });
  ctx.body = {
    address,
    contractTxIds: _.compact(validContractsOfType),
    type,
  };
}
