import { KoaContext } from "../types.js";
import { Next } from "koa";
import crypto from "crypto"
import logger from "../logger";

export async function loggerMiddleware(ctx: KoaContext, next: Next){
    const trace = crypto.randomUUID().substring(0, 6);
    const log = logger.child({trace, path: ctx.path, method: ctx.method, params: ctx.params})
    ctx.state.logger = log;
    ctx.state.trace = trace
    const startTime = Date.now();
    await next()
    const duration = Date.now() - startTime;
    log.debug('Completed request.', {
        responseTime: `${duration}ms`
    })
}
