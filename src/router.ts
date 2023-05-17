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
  walletInteractionHandler,
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
router.post(
  `/wallet/:address${PDNS_CONTRACT_ID_REGEX}/contracts`,
  walletContractHandler
);
router.get(
  `/wallet/:address${PDNS_CONTRACT_ID_REGEX}/contract/:id${PDNS_CONTRACT_ID_REGEX}`,
  walletInteractionHandler
);
router.get("/metrics", prometheusHandler);

export default router;
