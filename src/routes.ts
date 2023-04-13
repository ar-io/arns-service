import Router from "@koa/router";

const router = new Router();

// healthcheck
router.get('/healthcheck', (ctx) => {
    ctx.body = {
      timestamp: new Date(),
      status: 200,
      message: 'Hello world.'
    }
});

export default router;
