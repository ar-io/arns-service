import Koa from 'koa';
import router from './routes';
import cors from '@koa/cors';
import { loggerMiddleware, warpMiddleware, headersMiddleware } from './middleware';

const app = new Koa();

// attach middleware's
app.use(loggerMiddleware);
app.use(warpMiddleware);
app.use(headersMiddleware)
app.use(cors());
app.use(router.routes());

// TODO: add error metrics
app.on('error', (err) => {
  console.error(err)
});

app.listen(3000, () => {
  console.log('Server is listening on port 3000');
});
