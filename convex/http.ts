import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { MAX_PAYMENT_HEADER_BYTES } from "./lib/x402";
import { registerRemoteMcp } from "./mcpRemote";
import { registerWebHosting } from "./webHosting";

const http = httpRouter();

// x402-protected resource: paying it unlocks the purchase named in the path.
http.route({
  pathPrefix: "/x402/purchases/",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });
    const payment = headers["payment-signature"] ?? headers["x-payment"];
    if (payment && payment.length > MAX_PAYMENT_HEADER_BYTES) {
      return new Response(JSON.stringify({ error: "Payment header too large." }), { status: 413, headers: { "Content-Type": "application/json" } });
    }
    const url = new URL(request.url);
    const res = await ctx.runAction(internal.x402Node.sellerHandle, {
      method: request.method,
      url: request.url,
      path: url.pathname,
      headers,
    });
    return new Response(JSON.stringify(res.body ?? {}), {
      status: res.status,
      headers: { ...res.headers, "Content-Type": "application/json" },
    });
  }),
});

registerRemoteMcp(http);
registerWebHosting(http); // last: GET "/" prefix is the catch-all for the hosted console

export default http;
