import Router from '@koa/router';
import {
  ARNS_CONTRACT_FIELD_REGEX,
  ARNS_CONTRACT_ID_REGEX,
  ARNS_NAME_REGEX,
} from './constants';
import {
  contractAuctionsHandler,
  contractBalanceHandler,
  contractFieldHandler,
  contractHandler,
  contractInteractionsHandler,
  contractRecordHandler,
  contractReservedHandler,
  prometheusHandler,
  walletContractHandler,
} from './routes';

const router = new Router();

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
  `/v1/contract/:contractTxId${ARNS_CONTRACT_ID_REGEX}/auctions/:name${ARNS_NAME_REGEX}`,
  contractAuctionsHandler,
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

export default router;
