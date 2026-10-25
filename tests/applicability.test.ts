/// <reference types="vite/client" />
// Applicability checks (check_applicability) and the onboarding self-check (get_my_access).
import { convexTest } from "convex-test";
import { beforeAll, describe, expect, it } from "vitest";
import { api, internal } from "../convex/_generated/api";
import schema from "../convex/schema";
import { bundleHash, sha256Hex } from "../shared/bundle.mjs";
import { evaluateApplicability, validateConditions, validateFacts } from "../shared/applicability.mjs";

const modules = import.meta.glob("../convex/**/*.*s");
const SVC = "test-mcp-service-secret-000000000000";
const TOKENS = { a: "ixa_test_contributor_token_aaaaaaaaaaaaaaaa", b: "ixa_test_buyer_token_bbbbbbbbbbbbbbbbbbbbbbb", n: "ixa_test_no_preview_token_nnnnnnnnnnnnnnnn" };
beforeAll(() => {
  process.env.MCP_SERVICE_SECRET = SVC;
});
const errCode = async (p: Promise<unknown>) => {
  try {
    await p;
    return "NO_ERROR";
  } catch (e) {
    return (e as { data?: { code?: string } }).data?.code ?? String(e);
  }
};
const A = { svc: SVC, token: TOKENS.a };
const B = { svc: SVC, token: TOKENS.b };
const TENANT_CONDITIONS = [
  { fact: "records.tenant_scoped", expected: true },
  { fact: "request.authenticated_tenant", expected: true },
  { fact: "access.cross_tenant_sharing", expected: false, note: "Shared links need their own rule." },
];

async function setup() {
  const t = convexTest(schema, modules);
  await t.mutation(api.demo.reset, { actor: "review-desk" });
  const policy = (max: string, n: number) => ({ maxPerPurchaseAtomic: max, sessionMaxAtomic: String(Number(max) * n), maxPurchases: n, network: "eip155:84532", allowSimulator: true });
  await t.mutation(internal.mcp.upsertPrincipal, { name: "agent-a", orgSlug: "northstar", scopes: ["search", "preview", "submit", "status"], tokenHash: await sha256Hex(TOKENS.a), ttlDays: 1, policy: policy("0", 0) });
  await t.mutation(internal.mcp.upsertPrincipal, { name: "agent-b", orgSlug: "harbor", scopes: ["search", "preview", "quote", "acquire", "retrieve", "outcome"], tokenHash: await sha256Hex(TOKENS.b), ttlDays: 1, policy: policy("10000", 2) });
  await t.mutation(internal.mcp.upsertPrincipal, { name: "agent-n", orgSlug: "harbor", scopes: ["search"], tokenHash: await sha256Hex(TOKENS.n), ttlDays: 1, policy: policy("0", 0) });
  return t;
}

async function publishTenantGuide(t: Awaited<ReturnType<typeof setup>>, conditions: unknown = TENANT_CONDITIONS) {
  const b: Record<string, unknown> = {
    clientRequestId: `req-${Math.random().toString(36).slice(2, 10)}`, schemaVersion: "1",
    summary: "Cross-tenant read through a record id", symptoms: ["Another tenant's record is returned for a guessed id"], environmentCategories: ["Multi-tenant API"],
    rootCauseEvidence: "Lookup by id without an ownership check.", unsuccessfulApproaches: ["Hiding ids in the UI"], fixPattern: "Compare the record's tenant with the authenticated tenant; answer not found otherwise.",
    verificationEvidence: "Protected tests 5/5.", applicability: ["Records carry a tenant id"], limitations: ["List endpoints not covered"], sourceKind: "agent_resolved_bug", sharingLicense: "IX-DUL-1.0", priceAtomic: "10000", publicationConsent: true,
    ...(conditions === undefined ? {} : { conditions }),
  };
  b.contentHash = await bundleHash(b);
  b.approval = { kind: "developer_approval", reference: "test", contentHash: b.contentHash };
  const r = await t.mutation(api.mcp.submit, { ...A, bundle: b as never });
  await t.mutation(api.reviews.decide, { actor: "review-desk", draftId: r.submissionId, decision: "approve", note: "ok", evidenceLevel: "evidence_reviewed", checklist: { sixSectionsComplete: true, noSensitiveData: true, defensiveOnly: true, evidenceSupportsLabel: true, limitationsStated: true } });
  return (await t.run((ctx) => ctx.db.get(r.submissionId)))!.playbookId! as string;
}

describe("shared evaluator", () => {
  it("separates matches, conflicts and open facts without scores", () => {
    const conds = validateConditions(TENANT_CONDITIONS);
    const facts = validateFacts([{ fact: "records.tenant_scoped", value: true, source: "probe" }, { fact: "access.cross_tenant_sharing", value: true, source: "declared" }]);
    const r = evaluateApplicability(conds, facts);
    expect(r.matched.map((m) => m.fact)).toEqual(["records.tenant_scoped"]);
    expect(r.conflicts.map((m) => m.fact)).toEqual(["access.cross_tenant_sharing"]);
    expect(r.needsVerification.map((m) => m.fact)).toEqual(["request.authenticated_tenant"]);
    expect(r.recommendation).toBe("decline");
    expect(JSON.stringify(r)).not.toMatch(/confidence|score|%/);
  });
  it("rejects unknown fact keys from guides and from buyers", () => {
    expect(() => validateConditions([{ fact: "run.shell", expected: true }])).toThrow(/unknown fact/);
    expect(() => validateFacts([{ fact: "network.allow", value: true, source: "x" }])).toThrow(/unknown fact/);
  });
  it("never recommends a guide without structured conditions", () => {
    expect(evaluateApplicability([], [], { freeTextChecks: ["Duplicates share an event id"] }).recommendation).toBe("verify_first");
  });
});

describe("check_applicability", () => {
  it("keeps conditions through submission and publication, then recommends or declines from buyer facts", async () => {
    const t = await setup();
    const id = await publishTenantGuide(t);
    const pb = await t.run((ctx) => ctx.db.get(id as never));
    expect((pb as { applicability: { conditions?: unknown[] } }).applicability.conditions).toHaveLength(3);

    const ok = await t.mutation(api.mcp.checkApplicability, { ...B, resolutionId: id, facts: [
      { fact: "records.tenant_scoped", value: true, source: "probe: ports.mjs" },
      { fact: "request.authenticated_tenant", value: true, source: "probe: ports.mjs" },
      { fact: "access.cross_tenant_sharing", value: false, source: "declared" },
    ] });
    expect(ok.recommendation).toBe("recommend");
    expect(ok.matched).toHaveLength(3);

    const no = await t.mutation(api.mcp.checkApplicability, { ...B, resolutionId: id, facts: [{ fact: "records.tenant_scoped", value: false, source: "probe: no tenant field" }] });
    expect(no.recommendation).toBe("decline");
    expect(no.conflicts[0]).toMatchObject({ fact: "records.tenant_scoped", expected: true, observed: false });
    expect(no.needsVerification).toHaveLength(2);

    const rows = await t.run((ctx) => ctx.db.query("applicabilityChecks").collect());
    expect(rows.map((r) => r.recommendation)).toEqual(["recommend", "decline"]);
  });
  it("requires the preview scope, validates fact keys, and rejects bad guide conditions", async () => {
    const t = await setup();
    const id = await publishTenantGuide(t);
    expect(await errCode(t.mutation(api.mcp.checkApplicability, { svc: SVC, token: TOKENS.n, resolutionId: id, facts: [] }))).toBe("FORBIDDEN");
    expect(await errCode(t.mutation(api.mcp.checkApplicability, { ...B, resolutionId: id, facts: [{ fact: "exec", value: true, source: "x" }] }))).toBe("INVALID_INPUT");
    expect(await errCode(publishTenantGuide(t, [{ fact: "exec.command", expected: true }]))).toBe("INVALID_INPUT");
  });
  it("submissions without conditions keep their old content hash", async () => {
    const base = { summary: "s", priceAtomic: "10000" };
    expect(await bundleHash(base)).toBe(await bundleHash({ ...base, conditions: undefined }));
    expect(await bundleHash(base)).not.toBe(await bundleHash({ ...base, conditions: [] }));
  });
});

describe("get_my_access", () => {
  it("returns the caller's own org, scopes and budget, and records the connection", async () => {
    const t = await setup();
    const me = await t.mutation(api.mcp.myAccess, { ...B, via: "remote" });
    expect(me).toMatchObject({ principal: "agent-b", organization: { slug: "harbor" }, remaining: { purchases: 2, sessionAtomic: "20000" }, spent: { purchases: 0 } });
    expect(JSON.stringify(me)).not.toMatch(/tokenHash|ixa_/);
    const p = await t.run((ctx) => ctx.db.query("agentPrincipals").withIndex("by_name", (q) => q.eq("name", "agent-b")).unique());
    expect(p?.lastSeenVia).toBe("remote");
    expect(await errCode(t.mutation(api.mcp.myAccess, { svc: SVC, token: "ixa_not_a_real_token_000000000000", via: "local" }))).toBe("AUTH_REQUIRED");
    await t.mutation(internal.mcp.revokePrincipal, { name: "agent-b", revoked: true });
    expect(await errCode(t.mutation(api.mcp.myAccess, { ...B, via: "local" }))).toBe("AUTH_REQUIRED");
  });
});
