import { Next } from "koa";
import { KoaContext } from "../types.js";
import Arweave from "arweave";

export const arweave = new Arweave({
  protocol: "https",
  port: 443,
  host: process.env.GATEWAY_HOST ?? "ar-io.dev",
});

export function arweaveMiddleware(ctx: KoaContext, next: Next) {
  ctx.state.arweave = arweave;
  return next();
}
