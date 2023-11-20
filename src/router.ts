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
import Router from '@koa/router';
import { ARNS_CONTRACT_ID_REGEX, ARNS_NAME_REGEX } from './constants';
import {
  contractBalanceHandler,
  contractFieldHandler,
  contractHandler,
  contractInteractionsHandler,
  contractReadInteractionHandler,
  contractRecordFilterHandler,
  contractRecordHandler,
  contractReservedHandler,
  prometheusHandler,
  walletContractHandler,
} from './routes';
import { swaggerDocs } from './routes/swagger';
import { KoaContext } from './types';

const router: Router = new Router();

// healthcheck
router.get('/healthcheck', (ctx) => {
  ctx.body = {
    timestamp: new Date(),
    status: 200,
    message: 'Hello world.',
  };
});

// V1 endpoints
router.get(
  `/v1/contract/:contractTxId${ARNS_CONTRACT_ID_REGEX}`,
  contractHandler,
);
router.get(
  `/v1/contract/:contractTxId${ARNS_CONTRACT_ID_REGEX}/interactions`,
  contractInteractionsHandler,
);
router.get(
  `/v1/contract/:contractTxId${ARNS_CONTRACT_ID_REGEX}/interactions/:address${ARNS_CONTRACT_ID_REGEX}`,
  contractInteractionsHandler,
);
router.get(
  `/v1/contract/:contractTxId${ARNS_CONTRACT_ID_REGEX}/records/:name${ARNS_NAME_REGEX}`,
  contractRecordHandler,
);
router.get(
  // handles query params to filter records with a specific contractTxId (e.g. /v1/contract/<ARNS_REGISTRY>/records?contractTxId=<ARNS_CONTRACT_ID>)
  `/v1/contract/:contractTxId${ARNS_CONTRACT_ID_REGEX}/records`,
  contractRecordFilterHandler,
);
router.get(
  `/v1/contract/:contractTxId${ARNS_CONTRACT_ID_REGEX}/balances/:address${ARNS_CONTRACT_ID_REGEX}`,
  contractBalanceHandler,
);
// RESTful API to easy get auction prices
router.get(
  `/v1/contract/:contractTxId${ARNS_CONTRACT_ID_REGEX}/auctions/:name${ARNS_NAME_REGEX}`,
  (ctx: KoaContext) => {
    // set params for auction read interaction and then use our generic handler
    ctx.params.functionName = 'auction';
    ctx.query = {
      ...ctx.query,
      name: ctx.params.name,
    };
    return contractReadInteractionHandler(ctx);
  },
);
router.get(
  `/v1/contract/:contractTxId${ARNS_CONTRACT_ID_REGEX}/price`,
  (ctx: KoaContext) => {
    // set params for auction read interaction and then use our generic handler
    ctx.params.functionName = 'priceForInteraction';
    return contractReadInteractionHandler(ctx);
  },
);
// generic handler that handles read APIs for any contract function
router.get(
  `/v1/contract/:contractTxId${ARNS_CONTRACT_ID_REGEX}/read/:functionName`,
  contractReadInteractionHandler,
);
router.get(
  `/v1/contract/:contractTxId${ARNS_CONTRACT_ID_REGEX}/reserved/:name${ARNS_NAME_REGEX}`,
  contractReservedHandler,
);
// fallback for any other contract fields that don't include additional logic (i.e. this just returns partial contract state)
router.get(
  `/v1/contract/:contractTxId${ARNS_CONTRACT_ID_REGEX}/:field`,
  contractFieldHandler,
);
router.get(
  `/v1/wallet/:address${ARNS_CONTRACT_ID_REGEX}/contracts`,
  walletContractHandler,
);
router.get(
  `/v1/wallet/:address${ARNS_CONTRACT_ID_REGEX}/contract/:contractTxId${ARNS_CONTRACT_ID_REGEX}`,
  contractInteractionsHandler,
);

// prometheus
router.get('/arns_metrics', prometheusHandler);
// swagger
router.get('/api-docs', swaggerDocs);

export default router;
