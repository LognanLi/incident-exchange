// Remote MCP endpoint on Convex HTTP actions (HTTPS at <deployment>.convex.site/mcp), protected by OAuth 2.1
// bearer tokens. Same tool definitions as the local service (mcp/tools.mjs); authority comes only from the token.
import type { HttpRouter } from "convex/server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { buildServer } from "../mcp/tools.mjs";
import { SCOPES } from "./mcp";
import { AUTH_FAILURE_KEY } from "./rateLimit";

const MAX_BODY = 64 * 1024;
const site = () => (process.env.CONVEX_SITE_URL ?? "").replace(/\/$/, "");
const resource = () => `${site()}/mcp`;
const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers } });
const tooMany = (retryAfter: number) => json(429, { error: "rate_limited", error_description: `Too many requests; retry after ${retryAfter} s.` }, { "Retry-After": String(retryAfter) });
const tokenHelp = () => `POST ${site()}/oauth/token with grant_type=client_credentials, client_id, client_secret and resource=${resource()}`;
const challenge = (error?: string) =>
  `Bearer resource_metadata="${site()}/.well-known/oauth-protected-resource"${error ? `, error="${error}"` : ""}`;

function randomToken(prefix: string) {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return prefix + btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function sha256(text: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

const protectedResourceMetadata = httpAction(async () =>
  json(200, { resource: resource(), authorization_servers: [site()], scopes_supported: SCOPES, bearer_methods_supported: ["header"], resource_name: "Incident Exchange MCP" }),
);

export function registerRemoteMcp(http: HttpRouter) {
  http.route({ path: "/.well-known/oauth-protected-resource", method: "GET", handler: protectedResourceMetadata });
  http.route({ path: "/.well-known/oauth-protected-resource/mcp", method: "GET", handler: protectedResourceMetadata });
  http.route({
    path: "/.well-known/oauth-authorization-server",
    method: "GET",
    handler: httpAction(async () =>
      json(200, {
        issuer: site(),
        token_endpoint: `${site()}/oauth/token`,
        grant_types_supported: ["client_credentials"],
        token_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic"],
        scopes_supported: SCOPES,
        response_types_supported: [],
      }),
    ),
  });

  http.route({
    path: "/oauth/token",
    method: "POST",
    handler: httpAction(async (ctx, req) => {
      const raw = await req.text();
      if (raw.length > 4096) return json(413, { error: "invalid_request" });
      const form = new URLSearchParams(raw);
      let clientId = form.get("client_id") ?? "";
      let clientSecret = form.get("client_secret") ?? "";
      const basic = req.headers.get("authorization");
      if (basic?.startsWith("Basic ")) {
        const [id, secret] = atob(basic.slice(6)).split(":");
        clientId = decodeURIComponent(id ?? "");
        clientSecret = decodeURIComponent(secret ?? "");
      }
      const blocked = await ctx.runQuery(internal.rateLimit.authFailureBlock, {});
      if (blocked) return tooMany(blocked);
      if (form.get("grant_type") !== "client_credentials") return json(400, { error: "unsupported_grant_type", error_description: "Only grant_type=client_credentials is supported." });
      // RFC 8707: tokens are bound to this resource; another audience is refused.
      const audience = form.get("resource") ?? resource();
      if (audience !== resource()) return json(400, { error: "invalid_target", error_description: `resource must be exactly ${resource()}.` });
      if (!clientId || clientSecret.length < 20) return json(401, { error: "invalid_client" }, { "WWW-Authenticate": 'Basic realm="incident-exchange"' });
      const accessToken = randomToken("ixat_");
      const r = await ctx.runMutation(internal.oauth.issue, { clientId, clientSecret, accessTokenHash: await sha256(accessToken), audience, scope: form.get("scope") ?? undefined });
      if ("error" in r) {
        if (r.error === "rate_limited") return tooMany(r.retryAfter);
        const describe = {
          invalid_client: "Unknown client_id, wrong client_secret, or the credential expired or was revoked. Ask the exchange operator for a new one.",
          invalid_scope: "You asked for a scope this client was not granted. Omit scope to get all granted scopes.",
        } as const;
        return json(r.error === "invalid_client" ? 401 : 400, { error: r.error, error_description: describe[r.error as keyof typeof describe] });
      }
      return json(200, { access_token: accessToken, token_type: "Bearer", expires_in: r.expiresIn, scope: r.scopes.join(" ") });
    }),
  });

  http.route({
    path: "/mcp",
    method: "POST",
    handler: httpAction(async (ctx, req) => {
      const auth = req.headers.get("authorization") ?? "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
      if (!token) return json(401, { error: "unauthorized", error_description: `Bearer access token required. Get one: ${tokenHelp()}.` }, { "WWW-Authenticate": challenge() });
      const blocked = await ctx.runQuery(internal.rateLimit.authFailureBlock, {});
      if (blocked) return tooMany(blocked);
      const ok = await ctx.runQuery(internal.oauth.validate, { accessToken: token, audience: resource() });
      if (!ok.ok) {
        await ctx.runMutation(internal.rateLimit.hit, { key: AUTH_FAILURE_KEY, limit: "authFailures" });
        const longLived = token.startsWith("ixa_");
        return json(401, {
          error: "invalid_token",
          error_description: longLived
            ? `That is a long-lived client secret; it is not accepted as a bearer token. Exchange it for a 15-minute access token: ${tokenHelp()}.`
            : `Access token invalid or expired (they last 15 minutes and are bound to ${resource()}). Request a new one: ${tokenHelp()}.`,
        }, { "WWW-Authenticate": challenge("invalid_token") });
      }
      // The per-principal limit applies only after authentication, so unknown tokens add no keys.
      const limited = await ctx.runMutation(internal.rateLimit.hit, { key: `mcp:${ok.principal}`, limit: "mcp" });
      if (!limited.ok) return tooMany(limited.retryAfter);
      const len = Number(req.headers.get("content-length") ?? 0);
      if (len > MAX_BODY) return json(413, { error: "Request too large." });
      const svc = process.env.MCP_SERVICE_SECRET ?? "";
      const exec = (kind: "query" | "mutation" | "action", fn: any, args: any) =>
        kind === "query" ? ctx.runQuery(fn, args) : kind === "mutation" ? ctx.runMutation(fn, args) : ctx.runAction(fn, args);
      const server = buildServer({ token, svc, exec, deployment: "remote" });
      const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
      await server.connect(transport);
      try {
        return await transport.handleRequest(req);
      } finally {
        void server.close();
      }
    }),
  });
  // Any other POST path: say where the MCP endpoint is instead of a bare 404.
  http.route({
    pathPrefix: "/",
    method: "POST",
    handler: httpAction(async (_ctx, req) =>
      json(404, { error: "not_found", error_description: `No MCP server at ${new URL(req.url).pathname}. The Incident Exchange MCP endpoint is POST ${resource()} (Streamable HTTP, no trailing slash).` })),
  });
  http.route({ path: "/mcp", method: "GET", handler: httpAction(async () => json(405, { error: "Stateless server: POST only." }, { Allow: "POST" })) });
}
