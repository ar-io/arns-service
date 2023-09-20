import Koa from 'koa';
import router from './router';
import cors from '@koa/cors';
import bodyParser from 'koa-bodyparser';
import {
  arweaveMiddleware,
  loggerMiddleware,
  warpMiddleware,
  headersMiddleware,
  errorMiddleware,
} from './middleware';
import * as promClient from 'prom-client';
import logger from './logger';

const app = new Koa();

// attach middlewares
app.use(loggerMiddleware);
app.use(errorMiddleware);
app.use(arweaveMiddleware);
app.use(warpMiddleware);
app.use(headersMiddleware);
app.use(cors());
app.use(bodyParser());
app.use(router.routes());

// prometheus metric for errors
const errorCounter = new promClient.Counter({
  name: 'errors_total',
  help: 'Total error count',
});

// catch any floating errors, swallow them and increment prometheus counter
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception!', err);
  errorCounter.inc();
});

const serverConfigs = {
  port: +(process.env.PORT || 3000),
  keepAliveTimeout: 120_000, // two minute timeout for connections
  requestTimeout: 120_000, // two minute timeout for requests
};

app.listen(serverConfigs, () => {
  logger.info('Server is listening...', serverConfigs);
});
