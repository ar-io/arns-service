import { Next } from "koa";
import { KoaContext } from "../types";

const MAX_AGE_SECONDS = process.env.MAX_AGE_SECONDS ?? 120;

export async function headersMiddleware(ctx: KoaContext, next: Next) {
  await next();
  // add header at the end of all requests
  ctx.set("Cache-Control", `max-age=${MAX_AGE_SECONDS}`);
}
