import Koa, { Next } from 'koa';
import router from './routes';
import { WarpFactory } from 'warp-contracts';
import { KoaContext } from './types';

const app = new Koa();

// attach warp
app.use(async (ctx: KoaContext, next: Next) => {
  const warp = WarpFactory.forMainnet();
  ctx.state.warp = warp;
  return next();
});

app.use(router.routes());

app.listen(3000, () => {
  console.log('Server is listening on port 3000');
});
