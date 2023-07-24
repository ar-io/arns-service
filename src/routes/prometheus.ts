import { Next } from 'koa';
import { KoaContext } from '../types.js';
import * as promClient from 'prom-client';

const metricsRegistry = promClient.register;
promClient.collectDefaultMetrics({ register: metricsRegistry });

export async function prometheusHandler(ctx: KoaContext, next: Next) {
  ctx.body = await metricsRegistry.metrics();
  return next();
}
