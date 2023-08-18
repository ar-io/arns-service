import Router from '@koa/router';
import {
  ARNS_CONTRACT_FIELD_REGEX,
  ARNS_CONTRACT_ID_REGEX,
  ARNS_NAME_REGEX,
} from './constants';
import {
  contractBalanceHandler,
  contractFieldHandler,
  contractHandler,
  contractInteractionsHandler,
  contractRecordHandler,
  contractReservedHandler,
  prometheusHandler,
  walletContractHandler,
} from './routes';
import { swaggerDocs } from './routes/swagger';

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
  `/v1/contract/:contractTxId${ARNS_CONTRACT_ID_REGEX}/:field${ARNS_CONTRACT_FIELD_REGEX}`,
  contractFieldHandler,
);
router.get(
  `/v1/contract/:contractTxId${ARNS_CONTRACT_ID_REGEX}/balances/:address${ARNS_CONTRACT_ID_REGEX}`,
  contractBalanceHandler,
);
router.get(
  `/v1/contract/:contractTxId${ARNS_CONTRACT_ID_REGEX}/records/:name${ARNS_NAME_REGEX}`,
  contractRecordHandler,
);
router.get(
  `/v1/contract/:contractTxId${ARNS_CONTRACT_ID_REGEX}/reserved/:name${ARNS_NAME_REGEX}`,
  contractReservedHandler,
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
router.get('/metrics', prometheusHandler);
// swagger
router.get('/api-docs', swaggerDocs);

export default router;
