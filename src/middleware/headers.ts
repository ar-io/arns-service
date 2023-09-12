import { Next } from 'koa';
import { KoaContext } from '../types';

const MAX_AGE_SECONDS = process.env.MAX_AGE_SECONDS ?? 30;

export async function headersMiddleware(ctx: KoaContext, next: Next) {
  const { logger } = ctx.state;
  await next();
  if (ctx.status > 299) {
    // don't set cache if we got a bad response
    logger.debug('Setting cache-control to no-cache.');
    ctx.set('Cache-Control', 'no-cache');
  } else {
    logger.debug(`Setting cache-control to max-age=${MAX_AGE_SECONDS}.`);
    // add header at the end of all successful requests
    ctx.set('Cache-Control', `max-age=${MAX_AGE_SECONDS}`);
  }
}
