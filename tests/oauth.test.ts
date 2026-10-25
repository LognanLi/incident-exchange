// OAuth 2.1 client_credentials for the remote MCP endpoint (convex/mcpRemote.ts, convex/oauth.ts).
import { convexTest } from "convex-test";
import { beforeAll, describe, expect, it } from "vitest";
import { api, internal } from "../convex/_generated/api";
import schema from "../convex/schema";
import { sha256Hex } from "../shared/bundle.mjs";

const modules = import.meta.glob("../convex/**/*.*s");
const SITE = "https://test-deployment.convex.site";
const SECRET = "ixa_test_oauth_client_secret_bbbbbbbbbbbbbb";

beforeAll(() => {
  process.env.CONVEX_SITE_URL = SITE;
  process.env.MCP_SERVICE_SECRET = "test-mcp-service-secret-000000000000";
});

async function setup() {
  const t = convexTest(schema, modules);
  await t.mutation(api.demo.reset, { actor: "review-desk" });
  await t.mutation(internal.mcp.upsertPrincipal, { name: "agent-b", orgSlug: "harbor", scopes: ["search", "preview", "quote"], tokenHash: await sha256Hex(SECRET), ttlDays: 1, policy: { maxPerPurchaseAtomic: "0", sessionMaxAtomic: "0", maxPurchases: 0, network: "eip155:84532" } });
  return t;
}
const form = (o: Record<string, string>) => ({ method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(o).toString() });
const grant = (extra: Record<string, string> = {}) => form({ grant_type: "client_credentials", client_id: "agent-b", client_secret: SECRET, resource: `${SITE}/mcp`, ...extra });

describe("remote MCP OAuth", () => {
  it("publishes discovery metadata and challenges unauthenticated requests", async () => {
    const t = await setup();
    const prm = await (await t.fetch("/.well-known/oauth-protected-resource")).json();
    expect(prm).toMatchObject({ resource: `${SITE}/mcp`, authorization_servers: [SITE] });
    const res = await t.fetch("/mcp", { method: "POST", body: "{}" });
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toContain("resource_metadata=");
  });
  it("issues short-lived, audience-bound tokens only for valid clients", async () => {
    const t = await setup();
    expect((await t.fetch("/oauth/token", grant({ client_secret: "ixa_wrong_wrong_wrong_wrong_wrong" }))).status).toBe(401);
    expect(await (await t.fetch("/oauth/token", grant({ resource: "https://evil.example/mcp" }))).json()).toEqual({ error: "invalid_target" });
    expect(await (await t.fetch("/oauth/token", grant({ scope: "acquire" }))).json()).toEqual({ error: "invalid_scope" });
    const ok = await (await t.fetch("/oauth/token", grant())).json();
    expect(ok.token_type).toBe("Bearer");
    expect(ok.expires_in).toBeLessThanOrEqual(900);
    expect(await t.run((ctx) => ctx.db.query("oauthTokens").collect())).toHaveLength(1);
    expect(JSON.stringify(await t.run((ctx) => ctx.db.query("oauthTokens").collect()))).not.toContain(ok.access_token);
    expect(await t.query(internal.oauth.validate, { accessToken: ok.access_token, audience: `${SITE}/mcp` })).toMatchObject({ ok: true });
    expect(await t.query(internal.oauth.validate, { accessToken: ok.access_token, audience: "https://other/mcp" })).toMatchObject({ ok: false });
  });
  it("access tokens carry narrowed scopes and stop working when expired or revoked", async () => {
    const t = await setup();
    const svc = process.env.MCP_SERVICE_SECRET!;
    const narrow = await (await t.fetch("/oauth/token", grant({ scope: "search" }))).json();
    await t.query(api.mcp.search, { svc, token: narrow.access_token, symptoms: "duplicate jobs after webhook retries", environment: [] });
    await expect(t.mutation(api.mcp.quote, { svc, token: narrow.access_token, resolutionId: "x" })).rejects.toThrow(/FORBIDDEN/);
    await t.run(async (ctx) => {
      const tok = (await ctx.db.query("oauthTokens").collect())[0];
      await ctx.db.patch(tok._id, { expiresAt: Date.now() - 1 });
    });
    await expect(t.query(api.mcp.search, { svc, token: narrow.access_token, symptoms: "duplicate jobs after webhook retries", environment: [] })).rejects.toThrow(/AUTH_REQUIRED/);
    const fresh = await (await t.fetch("/oauth/token", grant())).json();
    await t.mutation(internal.mcp.revokePrincipal, { name: "agent-b", revoked: true });
    await expect(t.query(api.mcp.search, { svc, token: fresh.access_token, symptoms: "duplicate jobs after webhook retries", environment: [] })).rejects.toThrow(/AUTH_REQUIRED/);
  });
  it("rate-limits token issuance per client and locks out after repeated auth failures", async () => {
    const t = await setup();
    for (let i = 0; i < 20; i++) expect((await t.fetch("/oauth/token", grant())).status).toBe(200);
    const limited = await t.fetch("/oauth/token", grant());
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(await t.run((ctx) => ctx.db.query("oauthTokens").collect())).toHaveLength(20);

    const t2 = await setup();
    for (let i = 0; i < 30; i++) expect((await t2.fetch("/oauth/token", grant({ client_secret: "ixa_wrong_wrong_wrong_wrong_wrong" }))).status).toBe(401);
    expect((await t2.fetch("/oauth/token", grant())).status).toBe(429);
    expect((await t2.fetch("/mcp", { method: "POST", headers: { Authorization: "Bearer ixat_whatever" }, body: "{}" })).status).toBe(429);
    // Only the shared failure bucket exists: unknown clients add no keys.
    expect((await t2.run((ctx) => ctx.db.query("rateLimits").collect())).map((r) => r.key)).toEqual(["auth-failures"]);
  });
  it("rate-limits authenticated remote MCP requests per principal", async () => {
    const t = await setup();
    const tok = await (await t.fetch("/oauth/token", grant())).json();
    const call = () => t.fetch("/mcp", { method: "POST", headers: { Authorization: `Bearer ${tok.access_token}`, "Content-Type": "application/json", Accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) });
    expect((await call()).status).toBe(200);
    await t.run(async (ctx) => {
      const row = (await ctx.db.query("rateLimits").collect()).find((r) => r.key === "mcp:agent-b")!;
      await ctx.db.patch(row._id, { count: 120 });
    });
    const res = await call();
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "rate_limited" });
  });
});
