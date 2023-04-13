import Koa, { Next } from 'koa';
import router from './routes';
import { defaultCacheOptions, LoggerFactory, LogLevel, WarpFactory } from 'warp-contracts';
import { KoaContext } from './types';
import { LmdbCache } from "warp-contracts-lmdb";

const app = new Koa();

// attach warp
app.use(async (ctx: KoaContext, next: Next) => {

  LoggerFactory.INST.logLevel(process.env.LOG_LEVEL as LogLevel ?? 'debug');
  const warp = WarpFactory.forMainnet()
  .useStateCache(
    new LmdbCache({...defaultCacheOptions,})
  ).useContractCache(
    // Contract cache
    new LmdbCache({...defaultCacheOptions}), 
    // Source cache
    new LmdbCache({...defaultCacheOptions})
  );
  ctx.state.warp = warp;
  return next();
});

app.use(router.routes());

// TODO: add error metrics
app.on('error', (err) => {
  console.error(err)
});

app.listen(3000, () => {
  console.log('Server is listening on port 3000');
});
