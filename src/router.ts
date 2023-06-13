import Router from "@koa/router";
import {
  PDNS_CONTRACT_FIELD_REGEX,
  PDNS_CONTRACT_ID_REGEX,
  PDNS_NAME_REGEX,
} from "./constants";
import {
  contractBalanceHandler,
  contractFieldHandler,
  contractHandler,
  contractInteractionsHandler,
  contractRecordHandler,
  prometheusHandler,
  walletContractHandler,
} from "./routes";

const router = new Router();

// healthcheck
router.get("/healthcheck", (ctx) => {
  ctx.body = {
    timestamp: new Date(),
    status: 200,
    message: "Hello world.",
  };
});

// TODO: deprecate this in favor of versioned endpoints once portal is migrated
router.get(`/contract/:id${PDNS_CONTRACT_ID_REGEX}`, contractHandler);
router.get(
  `/contract/:id${PDNS_CONTRACT_ID_REGEX}/interactions`,
  contractInteractionsHandler
);
router.get(
  `/contract/:id${PDNS_CONTRACT_ID_REGEX}/:field${PDNS_CONTRACT_FIELD_REGEX}`,
  contractFieldHandler
);
router.get(
  `/contract/:id${PDNS_CONTRACT_ID_REGEX}/balances/:address${PDNS_CONTRACT_ID_REGEX}`,
  contractBalanceHandler
);
router.get(
  `/contract/:id${PDNS_CONTRACT_ID_REGEX}/records/:name${PDNS_NAME_REGEX}`,
  contractRecordHandler
);
router.get(
  `/wallet/:address${PDNS_CONTRACT_ID_REGEX}/contracts`,
  walletContractHandler
);
router.get(
  `/wallet/:address${PDNS_CONTRACT_ID_REGEX}/contract/:id${PDNS_CONTRACT_ID_REGEX}`,
  contractInteractionsHandler
);

// V1 endpoints
router.get(`/v1/contract/:id${PDNS_CONTRACT_ID_REGEX}`, contractHandler);
router.get(
  `/v1/contract/:id${PDNS_CONTRACT_ID_REGEX}/interactions`,
  contractInteractionsHandler
);
router.get(
  `/v1/contract/:id${PDNS_CONTRACT_ID_REGEX}/:field${PDNS_CONTRACT_FIELD_REGEX}`,
  contractFieldHandler
);
router.get(
  `/v1/contract/:id${PDNS_CONTRACT_ID_REGEX}/balances/:address${PDNS_CONTRACT_ID_REGEX}`,
  contractBalanceHandler
);
router.get(
  `/v1/contract/:id${PDNS_CONTRACT_ID_REGEX}/records/:name${PDNS_NAME_REGEX}`,
  contractRecordHandler
);
router.get(
  `/v1/wallet/:address${PDNS_CONTRACT_ID_REGEX}/contracts`,
  walletContractHandler
);
router.get(
  `/v1/wallet/:address${PDNS_CONTRACT_ID_REGEX}/contract/:id${PDNS_CONTRACT_ID_REGEX}`,
  contractInteractionsHandler
);

// prometheus
router.get("/arns_metrics", prometheusHandler);

export default router;
