#!/usr/bin/env node
// Incident Exchange: agent connection check. Self-contained; needs only `@modelcontextprotocol/sdk`.
//   npm i @modelcontextprotocol/sdk
//   IX_CLIENT_ID=... IX_CLIENT_SECRET=... node connect-check.mjs [--endpoint https://<deployment>.convex.site/mcp]
// Or with an existing access token: IX_ACCESS_TOKEN=... node connect-check.mjs --endpoint ...
// Local dev service (http://127.0.0.1:8787/mcp): IX_ACCESS_TOKEN=<ixa_ service token>.
// Runs: discovery → token → MCP initialize → tools/list → get_my_access (authorized) → search_resolutions.
// Never prints credentials or tokens.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(`--${k}`) ? args[args.indexOf(`--${k}`) + 1] : d);
const endpoint = opt("endpoint", process.env.IX_MCP_ENDPOINT ?? "https://quirky-robin-694.convex.site/mcp");
const EXPECTED_TOOLS = ["get_exchange_capabilities", "get_my_access", "search_resolutions", "get_resolution_preview", "check_applicability", "quote_resolution", "acquire_resolution", "get_resolution", "submit_resolution", "get_submission_status", "record_outcome"];

const ok = (s) => console.log(`  ✓ ${s}`);
const info = (s) => console.log(`    ${s}`);
function fail(step, message, hint, code = 1) {
  console.log(`  ✗ ${step}: ${message}`);
  if (hint) console.log(`    → ${hint}`);
  process.exit(code);
}
const netHint = (e) => {
  const c = e?.cause?.code ?? e?.code;
  if (c === "ENOTFOUND") return ["host not found", "Check the endpoint host name (copy it from the Connect your agent page)."];
  if (c === "ECONNREFUSED") return ["connection refused", "Nothing is listening there. For the local dev service, start it with npm run dev:mcp; otherwise check the URL."];
  if (c === "UND_ERR_CONNECT_TIMEOUT" || c === "ETIMEDOUT") return ["timed out", "The service is unreachable right now; retry, or check your network/proxy."];
  return [e?.message ?? String(e), "The service may be temporarily unavailable; retry shortly."];
};

console.log(`Incident Exchange connection check → ${endpoint}`);
let url;
try {
  url = new URL(endpoint);
} catch {
  fail("endpoint", "not a valid URL", "Use the full URL, e.g. https://<deployment>.convex.site/mcp", 2);
}
const local = ["127.0.0.1", "localhost"].includes(url.hostname);
if (!local && url.protocol !== "https:") fail("endpoint", "remote endpoints must use https", undefined, 2);
if (url.pathname !== "/mcp") console.log(`  ! path is ${url.pathname}; the exchange serves MCP at /mcp`);

// 1. Access token.
let token = process.env.IX_ACCESS_TOKEN;
if (!token) {
  const id = process.env.IX_CLIENT_ID;
  const secret = process.env.IX_CLIENT_SECRET;
  if (local) fail("credentials", "local dev service needs IX_ACCESS_TOKEN (an ixa_ service token)", undefined, 3);
  if (!id || !secret) fail("credentials", "set IX_CLIENT_ID and IX_CLIENT_SECRET (or IX_ACCESS_TOKEN)", "The exchange operator issues these per organization.", 3);
  let tokenEndpoint = `${url.origin}/oauth/token`;
  try {
    const prm = await fetch(`${url.origin}/.well-known/oauth-protected-resource`);
    if (prm.ok) {
      const meta = await prm.json();
      if (meta.resource !== endpoint) console.log(`  ! the server's resource is ${meta.resource}; tokens are bound to that exact URL`);
      const as = await fetch(`${meta.authorization_servers?.[0] ?? url.origin}/.well-known/oauth-authorization-server`);
      if (as.ok) tokenEndpoint = (await as.json()).token_endpoint ?? tokenEndpoint;
      ok(`discovery: protected resource + authorization server metadata (${tokenEndpoint})`);
    } else info(`discovery metadata not found (HTTP ${prm.status}); trying ${tokenEndpoint}`);
  } catch (e) {
    const [m, h] = netHint(e);
    fail("discovery", m, h, 4);
  }
  let res;
  try {
    res = await fetch(tokenEndpoint, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "client_credentials", client_id: id, client_secret: secret, resource: endpoint }) });
  } catch (e) {
    const [m, h] = netHint(e);
    fail("token", m, h, 4);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const fallback = res.status === 429 ? `Rate limited; retry after ${res.headers.get("retry-after")} s.`
      : res.status === 404 ? "No token endpoint at this host: check the deployment URL (copy it from the Connect your agent page)."
      : res.status >= 500 ? "Service unavailable; retry shortly." : undefined;
    fail("token", `${res.status} ${body.error ?? ""}`.trim(), body.error_description ?? fallback, 5);
  }
  token = body.access_token;
  ok(`token: access token issued (expires in ${body.expires_in} s; scopes: ${body.scope})`);
}

// 2. MCP initialize + tools/list.
const client = new Client({ name: "incident-exchange-connect-check", version: "1.0.0" });
const transport = new StreamableHTTPClientTransport(url, { requestInit: { headers: { Authorization: `Bearer ${token}` } } });
try {
  await client.connect(transport);
} catch (e) {
  const status = e?.code;
  const text = String(e?.message ?? e);
  const hint =
    status === 401 ? (text.includes("invalid_token") ? "The access token is invalid or expired (15 minutes). Request a new one." : "Send Authorization: Bearer <access token>.")
    : status === 404 ? "Wrong path: the MCP endpoint is POST <site>/mcp (no trailing slash)."
    : status === 405 ? "This server is stateless: POST only (Streamable HTTP, JSON responses)."
    : status === 429 ? "Rate limited; wait and retry."
    : status >= 500 ? "Service unavailable; retry shortly."
    : netHint(e)[1];
  fail("initialize", status ? `HTTP ${status}` : netHint(e)[0], hint, 6);
}
ok(`initialize: ${client.getServerVersion()?.name ?? "server"} ${client.getServerVersion()?.version ?? ""} (protocol ${transport.protocolVersion ?? "negotiated"})`);
const tools = (await client.listTools()).tools.map((t) => t.name);
const missing = EXPECTED_TOOLS.filter((t) => !tools.includes(t));
if (missing.length) console.log(`  ! tools/list: ${tools.length} tools; missing ${missing.join(", ")} (older server?)`);
else ok(`tools/list: ${tools.length} tools`);

const call = async (name, a = {}) => {
  const r = await client.callTool({ name, arguments: a });
  return { isError: !!r.isError, text: r.content?.[0]?.text ?? "", data: r.structuredContent?.data };
};

// 3. Authorized call: who am I?
const me = await call("get_my_access");
if (me.isError) fail("get_my_access", me.text, me.text.startsWith("AUTH_REQUIRED") ? "Credential invalid, expired or revoked: ask the operator for a new one." : undefined, 7);
ok(`get_my_access: ${me.data.principal} for ${me.data.organization.displayName} (${me.data.organization.slug})`);
info(`scopes: ${me.data.scopes.join(", ") || "none"}`);
info(`credential expires: ${new Date(me.data.credential.principalExpiresAt).toISOString()}`);
info(`test budget: ${me.data.remaining.purchases} purchase(s), ${me.data.remaining.sessionAtomic} atomic test USDC left (≤ ${me.data.spendPolicy.maxPerPurchaseAtomic} per purchase; simulator ${me.data.spendPolicy.allowSimulator ? "allowed" : "not allowed"})`);

// 4. A scoped call.
if (!me.data.scopes.includes("search")) {
  console.log("  - search_resolutions skipped: this credential lacks the search scope");
} else {
  const s = await call("search_resolutions", { symptoms: opt("query", "the same job is queued twice when the sender retries a notification"), environment: [] });
  if (s.isError && s.text.startsWith("NO_RELEVANT_MATCH")) ok("search_resolutions: no relevant match for the sample query (an honest empty answer)");
  else if (s.isError) fail("search_resolutions", s.text, s.text.startsWith("FORBIDDEN") ? "Ask the operator for the missing scope." : undefined, 8);
  else ok(`search_resolutions: ${s.text}`);
}
await client.close();
console.log("Connection check passed.");
