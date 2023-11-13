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
import { BadRequestError, KoaContext } from '../types';
import {
  getContractsTransferredToOrControlledByWallet,
  getDeployedContractsByWallet,
} from '../api/graphql';
import { isValidContractType, validateStateWithTimeout } from '../api/warp';
import { allowedContractTypes } from '../constants';
import * as _ from 'lodash';

export async function walletContractHandler(ctx: KoaContext, next: Next) {
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

  const [{ ids: deployedContractTxIds }, { ids: controlledOrOwnedIds }] =
    await Promise.all([
      getDeployedContractsByWallet(arweave, { address }),
      getContractsTransferredToOrControlledByWallet(arweave, { address }),
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

  // NOTE: this may take a long time since it must evaluate all contract states.
  // We use a wrapper to limit the amount of time evaluating each contract.
  // This will basically cap the total amount of time we'll evaluate states before
  // returning.
  const startTime = Date.now();
  const validContractsOfType = (
    await Promise.allSettled(
      [...deployedOrOwned].map(async (id: string) =>
        // do not pass any evaluation options, the contract manifests will be fetched for each of these so they properly evaluate
        (await validateStateWithTimeout({
          contractTxId: id,
          warp,
          type,
          address,
          logger,
        }))
          ? id
          : null,
      ),
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

  return next();
}
