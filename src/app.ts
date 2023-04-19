import Koa from 'koa';
import router from './routes';
import cors from '@koa/cors';
import loggerMiddleware from './middleware/logger';
import warpMiddleware from './middleware/warp';
import headersMiddleware from './middleware/headers';

const app = new Koa();

// attach middlewares
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
