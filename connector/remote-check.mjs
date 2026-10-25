// Remote MCP + OAuth check against the HTTPS endpoint on Convex (<deployment>.convex.site/mcp).
// Uses the official SDK client. Prints decisions only, never credential values.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { join } from "node:path";
import { ROOT, readEnv } from "./lib/mcpClient.mjs";

const SITE = readEnv(join(ROOT, ".env.local")).VITE_CONVEX_SITE_URL.replace(/\/$/, "");
const toks = readEnv(join(ROOT, ".agent-tokens.local"));
const RESOURCE = `${SITE}/mcp`;
let failures = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name.padEnd(46)} ${detail}`);
};
const token = async (clientId, secret, extra = {}) => {
  const res = await fetch(`${SITE}/oauth/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: secret, resource: RESOURCE, ...extra }) });
  return { status: res.status, body: await res.json() };
};
const connect = async (accessToken) => {
  const client = new Client({ name: "remote-check", version: "1.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(RESOURCE), { requestInit: { headers: { Authorization: `Bearer ${accessToken}` } } }));
  return client;
};

// Discovery (RFC 9728 / RFC 8414)
const unauth = await fetch(RESOURCE, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" }, body: "{}" });
const wwwAuth = unauth.headers.get("www-authenticate") ?? "";
check("no token → 401 + resource_metadata challenge", unauth.status === 401 && wwwAuth.includes("resource_metadata="), `HTTP ${unauth.status}`);
const prm = await (await fetch(`${SITE}/.well-known/oauth-protected-resource`)).json();
check("protected resource metadata", prm.resource === RESOURCE && prm.authorization_servers?.[0] === SITE, prm.resource);
const asm = await (await fetch(`${SITE}/.well-known/oauth-authorization-server`)).json();
check("authorization server metadata", asm.token_endpoint === `${SITE}/oauth/token` && asm.grant_types_supported.includes("client_credentials"));

// Token endpoint
check("wrong client secret → invalid_client", (await token("agent-b", "ixa_wrong_secret_value_0000000000000")).body.error === "invalid_client");
check("other audience → invalid_target", (await token("agent-b", toks.AGENT_B_TOKEN, { resource: "https://evil.example/mcp" })).body.error === "invalid_target");
check("scope beyond principal → invalid_scope", (await token("agent-a", toks.AGENT_A_TOKEN, { scope: "acquire" })).body.error === "invalid_scope");
const devAsBearer = await fetch(RESOURCE, { method: "POST", headers: { Authorization: `Bearer ${toks.AGENT_B_TOKEN}`, "Content-Type": "application/json" }, body: "{}" });
check("long-lived client secret not accepted as bearer", devAsBearer.status === 401, `HTTP ${devAsBearer.status}`);
const b = await token("agent-b", toks.AGENT_B_TOKEN);
check("client_credentials → access token", b.status === 200 && b.body.token_type === "Bearer" && b.body.expires_in <= 900, `expires_in ${b.body.expires_in}s, scope "${b.body.scope}"`);

// MCP over HTTPS with the access token
const c = await connect(b.body.access_token);
const tools = (await c.listTools()).tools.map((t) => t.name);
check("initialize + tools/list over HTTPS", tools.length === 11 && ["check_applicability", "get_my_access"].every((n) => tools.includes(n)), `${tools.length} tools, protocol ${c.getServerVersion()?.name}`);
const s = await c.callTool({ name: "search_resolutions", arguments: { symptoms: "messages get processed twice when the broker redelivers them", environment: [] } });
check("search_resolutions (remote)", !s.isError, (s.content[0]?.text ?? "").slice(0, 90));
const irrelevant = await c.callTool({ name: "search_resolutions", arguments: { symptoms: "how do I bake sourdough bread at home", environment: [] } });
check("irrelevant query → NO_RELEVANT_MATCH", JSON.stringify(irrelevant).includes("NO_RELEVANT_MATCH"));
const pay = await c.callTool({ name: "get_resolution", arguments: { resolutionId: "k97cvmjh1hhbnbdy9k9jhz2d558gx0wg" } });
check("paywall holds remotely", pay.isError && /ENTITLEMENT_REQUIRED|NOT_FOUND/.test(pay.content[0].text), pay.content[0].text.slice(0, 60));
await c.close();

// Scope narrowing: a search-only token cannot quote
const narrow = await token("agent-b", toks.AGENT_B_TOKEN, { scope: "search" });
const c2 = await connect(narrow.body.access_token);
const q = await c2.callTool({ name: "quote_resolution", arguments: { resolutionId: "k97cvmjh1hhbnbdy9k9jhz2d558gx0wg" } });
check("narrowed token (scope=search) cannot quote", q.isError && q.content[0].text.startsWith("FORBIDDEN"), q.content[0].text.slice(0, 60));
await c2.close();

console.log(failures ? `\n${failures} check(s) failed` : "\nall remote checks passed");
process.exit(failures ? 1 : 0);
