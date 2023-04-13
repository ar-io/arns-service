import Router from "@koa/router";
import { contractHandler } from "./routes/contract";
import { ARNS_CONTRACT_ID_REGEX } from "./constants";

const router = new Router();

// healthcheck
router.get('/healthcheck', (ctx) => {
    ctx.body = {
      timestamp: new Date(),
      status: 200,
      message: 'Hello world.'
    }
});

router.get(`/contract/:id${ARNS_CONTRACT_ID_REGEX}`, contractHandler)

export default router;
