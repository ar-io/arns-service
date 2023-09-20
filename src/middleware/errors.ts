import { KoaContext } from '../types';
import { Next } from 'koa';
import { BadRequestError, EvaluationError, NotFoundError } from '../types';

// globally handle errors and return proper status based on their type
export async function errorMiddleware(ctx: KoaContext, next: Next) {
  const { logger } = ctx.state;
  try {
    await next();
  } catch (error) {
    logger.error('Error processing request.', {
      error: error instanceof Error ? error.message : error,
    });
    if (error instanceof EvaluationError || error instanceof BadRequestError) {
      ctx.status = 400;
      ctx.body = error.message;
    } else if (error instanceof NotFoundError) {
      ctx.status = 404;
      ctx.body = error.message;
    } else {
      // log full stack trace when 503s are returned to client to help with debugging
      logger.error('Unknown error returned to client.', error);
      ctx.status = 503;
      ctx.body = 'Internal server error.';
    }
  }
}
