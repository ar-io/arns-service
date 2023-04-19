import winston, { format, transports } from "winston";
import { KoaContext } from "../types.js";
import { Next } from "koa";
import crypto from "crypto"

const LOG_LEVEL = process.env.LOG_LEVEL ?? 'info';
const LOG_FORMAT = process.env.LOG_FORMAT ?? 'json';

const logger = winston.createLogger({
    level: LOG_LEVEL,
    format: format.combine(
      format.errors(),
      format.timestamp(),
      LOG_FORMAT === 'json' ? format.json() : format.simple(),
    ),
    transports: new transports.Console(),
});

export default async function loggerMiddleware(ctx: KoaContext, next: Next){
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
