/// <reference types="vite/client" />
// Agent activity details and the payment inspector: states come only from stored records; details are sanitized.
import { convexTest } from "convex-test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { api, internal } from "../convex/_generated/api";
import schema from "../convex/schema";
import { sha256Hex } from "../shared/bundle.mjs";
import { sanitizeEventDetail } from "../shared/eventDetail.mjs";
import { derivePayment } from "../convex/lib/payments";
import { mintSession } from "../shared/session.mjs";
import { duringRun, paymentAt, recordedUntil, type Recording } from "../src/components/agents/timeline";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PaymentInspector } from "../src/components/agents/payments";

const modules = import.meta.glob("../convex/**/*.*s");
const SVC = "test-mcp-service-secret-000000000000";
const RUNNER = "test-runner-secret-0000000000000000";
const TOKENS = { a: "ixa_test_contributor_token_aaaaaaaaaaaaaaaa", b: "ixa_test_buyer_token_bbbbbbbbbbbbbbbbbbbbbbb" };
const PAYEE = "0x22204BeDAdC581473c5472B2F797f30902d85527";
const CDP = ["CDP_API_KEY_ID", "CDP_API_KEY_SECRET", "CDP_WALLET_SECRET"] as const;

beforeAll(() => {
  process.env.MCP_SERVICE_SECRET = SVC;
  process.env.FACTORY_RUNNER_SECRET = RUNNER;
  for (const k of CDP) process.env[k] = "test-placeholder";
});
afterAll(() => {
  for (const k of CDP) delete process.env[k];
});
const B = { svc: SVC, token: TOKENS.b };
const errCode = async (p: Promise<unknown>) => {
  try {
    const r = (await p) as { __denied?: { code: string } } | null;
    return r?.__denied ? r.__denied.code : "NO_ERROR";
  } catch (e) {
    return (e as { data?: { code?: string } }).data?.code ?? String(e);
  }
};

async function setup({ maxPurchases = 2, perPurchase = "10000" } = {}) {
  const t = convexTest(schema, modules);
  await t.mutation(api.demo.reset, { actor: "review-desk" });
  await t.run(async (ctx) => {
    await ctx.db.insert("x402Wallets", { role: "receiver", accountName: "test-receiver", address: PAYEE, network: "eip155:84532", updatedAt: Date.now() });
  });
  await t.mutation(internal.mcp.upsertPrincipal, { name: "agent-a", orgSlug: "northstar", scopes: ["search", "preview", "submit", "status"], tokenHash: await sha256Hex(TOKENS.a), ttlDays: 1, policy: { maxPerPurchaseAtomic: "0", sessionMaxAtomic: "0", maxPurchases: 0, network: "eip155:84532" } });
  await t.mutation(internal.mcp.upsertPrincipal, { name: "agent-b", orgSlug: "harbor", scopes: ["search", "preview", "quote", "acquire", "retrieve", "outcome"], tokenHash: await sha256Hex(TOKENS.b), ttlDays: 1, policy: { maxPerPurchaseAtomic: perPurchase, sessionMaxAtomic: String(Number(perPurchase) * maxPurchases), maxPurchases, network: "eip155:84532", allowSimulator: true } });
  // A cheap (0.01) and an expensive (seeded ≥ 0.10) active guide.
  const guides = await t.run(async (ctx) => (await ctx.db.query("playbooks").collect()).filter((p) => p.active));
  const cheapId = guides[0]._id;
  await t.run(async (ctx) => ctx.db.patch(cheapId, { priceAtomic: "10000" }));
  const pricey = guides.find((g) => g._id !== cheapId && BigInt(g.priceAtomic) > 10000n)!;
  return { t, cheap: cheapId as string, pricey: pricey._id as string };
}
const approved = { payTo: PAYEE, maxAmountAtomic: "10000", network: "eip155:84532" };
const overview = (t: Awaited<ReturnType<typeof setup>>["t"]) => t.query(api.agentsConsole.overview, { actor: "review-desk" });

describe("derivePayment (pure)", () => {
  const q = { createdAt: 1, expiresAt: 100, status: "open" as const };
  it("covers requested, expired, refused, authorized, settling, unconfirmed, failed, canceled, settled, simulated", () => {
    expect(derivePayment(q, null, null, 50).state).toBe("requested");
    expect(derivePayment(q, null, null, 500).state).toBe("expired");
    expect(derivePayment(q, null, { kind: "budget_exceeded", at: 2, summary: "refused" }, 50).steps[1]).toMatchObject({ state: "failed", label: "Refused by spend policy" });
    const base = { provider: "x402_test" as const, createdAt: 3, completedAt: 9, x402: { network: "n", asset: "a", atomicAmount: "1", payTo: "p" } };
    expect(derivePayment(q, { ...base, paymentStatus: "pending" }, null, 50).state).toBe("authorized");
    expect(derivePayment(q, { ...base, paymentStatus: "pending", x402: { ...base.x402, settlingAt: 5 } }, null, 50).state).toBe("settling");
    expect(derivePayment(q, { ...base, paymentStatus: "pending", x402: { ...base.x402, settlingAt: 5, error: "rpc" } }, null, 50).state).toBe("unconfirmed");
    expect(derivePayment(q, { ...base, paymentStatus: "failed", x402: { ...base.x402, error: "boom" } }, null, 50).steps[2]).toMatchObject({ state: "failed", note: "boom" });
    expect(derivePayment(q, { ...base, paymentStatus: "cancelled" }, null, 50).state).toBe("canceled");
    const settled = derivePayment(q, { ...base, paymentStatus: "test_success" }, null, 50);
    expect(settled.state).toBe("settled");
    expect(settled.steps.map((s) => s.state)).toEqual(["done", "done", "done", "done"]);
    expect(derivePayment(q, { ...base, provider: "demo_simulator", paymentStatus: "simulated_success" }, null, 50).state).toBe("simulated");
  });
});

describe("sanitizeEventDetail", () => {
  it("drops credential keys, redacts credential-looking values, and bounds sizes", () => {
    const d = sanitizeEventDetail({
      tool: "acquire_resolution",
      input: [{ k: "Authorization", v: "Bearer abc" }, { k: "access token", v: "x" }, { k: "signature", v: "0xdead" }, { k: "nonce", v: "1" }, { k: "symptoms", v: "used sk_live_abcdefghijklmnop to call" }, { k: "payee", v: PAYEE }],
      result: "y".repeat(1000),
      resolutionId: "../../etc",
      revision: -3,
    })!;
    expect(d.input!.map((e) => e.k)).toEqual(["symptoms", "payee"]);
    expect(d.input![0].v).toMatch(/^\[redacted: api_token/);
    expect(d.result!.length).toBe(300);
    expect(d.resolutionId).toBeUndefined();
    expect(d.revision).toBeUndefined();
  });
  it("scans before truncation and removes exchange credentials and signed payloads", () => {
    for (const value of ["x".repeat(239) + " sk_live_abcdefghijklmnop", "ixa_any_service_credential_0123456789", "ixat_access_0123456789", "ixs2.harbor.123.o.signature", "0x" + "a".repeat(130)]) {
      expect(sanitizeEventDetail({ result: value })?.result).toMatch(/^\[redacted:/);
    }
  });
});

describe("payment inspector", () => {
  it("shows an over-budget refusal with evidence and no purchase", async () => {
    const { t, pricey } = await setup();
    const q = await t.mutation(api.mcp.quote, { ...B, resolutionId: pricey });
    expect(await errCode(t.mutation(api.mcp.acquire, { ...B, quoteId: q.quoteId, clientRequestId: "req-over-1", approved: { ...approved, maxAmountAtomic: q.price.amountAtomic }, simulate: true }))).toBe("BUDGET_EXCEEDED");
    const o = await overview(t);
    const p = o.payments.find((x) => x.quoteId === q.quoteId)!;
    expect(p).toMatchObject({ state: "refused", purchaseId: null, payTo: PAYEE, network: "eip155:84532" });
    const ev = o.events.find((e) => e.kind === "budget_exceeded")!;
    expect(ev.detail?.tool).toBe("acquire_resolution");
    expect(ev.detail?.evidence?.find((x) => x.k === "policy max per purchase")?.v).toBe("10000");
    expect(await t.run((ctx) => ctx.db.query("purchases").collect())).toHaveLength(0);
  });

  it("simulated purchases grant access but never count as earnings", async () => {
    const { t, cheap } = await setup();
    const q = await t.mutation(api.mcp.quote, { ...B, resolutionId: cheap });
    const ref = await t.mutation(api.mcp.acquire, { ...B, quoteId: q.quoteId, clientRequestId: "req-sim-1", approved, simulate: true });
    await t.mutation(api.mcp.completeSimulated, { ...B, purchaseId: ref.purchaseId });
    const o = await overview(t);
    expect(o.payments[0]).toMatchObject({ state: "simulated", mode: "simulated" });
    expect(o.payments[0].authorizedBudget).toMatchObject({ maxPerPurchaseAtomic: "10000", sessionMaxAtomic: "20000", committedBeforeAtomic: "0", remainingAfterAtomic: "10000", remainingPurchases: 1 });
    expect(o.earnings).toMatchObject({ grossAtomic: "0", contributorAccruedAtomic: "0", paidOutAtomic: "0", simulatedSales: 1, testnetSales: 0, balanced: true });
  });

  it("settles x402 with an exact 80/20 accrual, records a settlement event, and reuses on re-acquire", async () => {
    const { t, cheap } = await setup();
    const q = await t.mutation(api.mcp.quote, { ...B, resolutionId: cheap });
    const ref = await t.mutation(api.mcp.acquire, { ...B, quoteId: q.quoteId, clientRequestId: "req-x402-1", approved, simulate: false });
    expect((await overview(t)).payments[0].state).toBe("authorized");
    await t.mutation(internal.x402State.recordSuccess, { purchaseId: ref.purchaseId as never, payer: "0x1111111111111111111111111111111111111111", txHash: "0xabc123", network: "eip155:84532" });
    const o = await overview(t);
    expect(o.payments[0]).toMatchObject({ state: "settled", txHash: "0xabc123", contributorShareAtomic: "8000", platformShareAtomic: "2000" });
    expect(o.earnings).toMatchObject({ grossAtomic: "10000", contributorAccruedAtomic: "8000", platformFeeAtomic: "2000", paidOutAtomic: "0", balanced: true });
    expect(o.events.find((e) => e.kind === "payment_settled")?.detail?.evidence?.find((x) => x.k === "transaction")?.v).toBe("0xabc123");
    // Same revision again: the double-purchase guard returns the existing purchase, no new row.
    const q2 = await t.mutation(api.mcp.quote, { ...B, resolutionId: cheap });
    const again = await t.mutation(api.mcp.acquire, { ...B, quoteId: q2.quoteId, clientRequestId: "req-x402-2", approved, simulate: false });
    expect(again).toMatchObject({ purchaseId: ref.purchaseId, status: "entitled" });
    expect(await t.run((ctx) => ctx.db.query("purchases").collect())).toHaveLength(1);
    const after = await overview(t);
    expect(after.payments.find((p) => p.quoteId === q2.quoteId)).toMatchObject({ state: "settled", purchaseId: ref.purchaseId, reusedCount: 1 });
    // Newer unbought quotes cannot hide the original paid receipt.
    for (let i = 0; i < 15; i++) await t.mutation(api.mcp.quote, { ...B, resolutionId: cheap });
    expect((await overview(t)).payments.find((p) => p.quoteId === q.quoteId)?.txHash).toBe("0xabc123");
  });

  it("cancellation never grants access, never accrues, and cannot cancel or switch a signed payment", async () => {
    const { t, cheap } = await setup();
    const q = await t.mutation(api.mcp.quote, { ...B, resolutionId: cheap });
    const r = await t.mutation(api.mcp.acquire, { ...B, quoteId: q.quoteId, clientRequestId: "req-cancel-1", approved, simulate: true });
    await t.mutation(api.purchases.cancel, { actor: "harbor", purchaseId: r.purchaseId as never });
    expect((await overview(t)).payments[0]).toMatchObject({ state: "canceled", allowanceNow: { committedAtomic: "0" } });
    expect(await errCode(t.query(api.mcp.getResolution, { ...B, resolutionId: cheap }))).toBe("ENTITLEMENT_REQUIRED");
    expect(await errCode(t.mutation(api.mcp.completeSimulated, { ...B, purchaseId: r.purchaseId }))).toBe("PAYMENT_FAILED");
    expect((await overview(t)).earnings.grossAtomic).toBe("0");
    const q2 = await t.mutation(api.mcp.quote, { ...B, resolutionId: cheap });
    const r2 = await t.mutation(api.mcp.acquire, { ...B, quoteId: q2.quoteId, clientRequestId: "req-cancel-2", approved, simulate: false });
    await t.mutation(internal.x402State.markSettling, { purchaseId: r2.purchaseId as never, payer: PAYEE, nonce: "never-public-authorization-id" });
    await expect(t.mutation(api.purchases.cancel, { actor: "harbor", purchaseId: r2.purchaseId as never })).rejects.toThrow(/confirmed/);
    await expect(t.mutation(api.purchases.startCheckout, { actor: "harbor", playbookId: cheap as never, preference: "demo_simulator", acceptLicense: true })).rejects.toThrow(/confirmed/);
    const receipt = await t.query(api.purchases.get, { actor: "harbor", purchaseId: r2.purchaseId as never });
    expect(receipt?.x402?.awaitingConfirmation).toBe(true);
    expect(JSON.stringify(receipt)).not.toContain("never-public-authorization-id");
    expect((await t.mutation(internal.x402State.markSettling, { purchaseId: r2.purchaseId as never, payer: PAYEE, nonce: "other-id" })).ok).toBe(false);
  });

  it("replay hides future settlement, access, and events; payment labels match persisted states", async () => {
    const { t, cheap } = await setup();
    const q = await t.mutation(api.mcp.quote, { ...B, resolutionId: cheap });
    const r = await t.mutation(api.mcp.acquire, { ...B, quoteId: q.quoteId, clientRequestId: "req-replay-1", approved, simulate: false });
    await t.mutation(internal.x402State.recordSuccess, { purchaseId: r.purchaseId as never, txHash: "0xrealreceipt", network: "eip155:84532" });
    const o = await overview(t);
    const payment = { ...o.payments[0], quotedAt: 100, steps: o.payments[0].steps.map((s, i) => ({ ...s, at: [100, 200, 400, 400][i] })) };
    expect(paymentAt(payment, 150)).toMatchObject({ state: "requested", txHash: null });
    expect(paymentAt(payment, 250)).toMatchObject({ state: "authorized", txHash: null });
    expect(paymentAt(payment, 450)).toMatchObject({ state: "settled", txHash: "0xrealreceipt" });
    expect(paymentAt(payment, 250).steps[3].state).toBe("todo");
    const recording = { run: { startedAt: 100, finishedAt: 500, durationMs: 400 }, overview: { ...o, payments: [payment], events: [{ ...o.events[0], at: 400 }] } } as Recording;
    expect(recordedUntil(recording, 250).events).toHaveLength(0);
    expect(recordedUntil(recording, 250).payments[0].state).toBe("authorized");
    expect(duringRun(recording.overview, { startedAt: 100, finishedAt: 300 } as never).events).toHaveLength(0);
    const cases = { requested: "Quote requested", refused: "Refused", expired: "Quote expired", authorized: "Authorized", settling: "Pending settlement", unconfirmed: "Unconfirmed", settled: "Settled · testnet", simulated: "Simulated", failed: "Failed", canceled: "Canceled" } as const;
    for (const [state, label] of Object.entries(cases)) {
      const html = renderToStaticMarkup(createElement(PaymentInspector, { payments: [{ ...payment, state: state as typeof payment.state }], recorded: false }));
      expect(html).toContain(label);
    }
  });

  it("local patches and private runner notes are visible only to the operator or owning organization", async () => {
    const { t } = await setup();
    process.env.DEMO_SESSION_SECRET = "test-session-secret-000000000000000000";
    await t.mutation(api.mcp.recordRepairRun, { runnerSecret: RUNNER, principalName: "agent-a", repo: "repo-a", stage: "candidate", toolName: "runner", passed: true, total: 1, passedCount: 1, tests: [{ name: "protected", ok: true }], changedFiles: ["src/example.mjs"], candidateHash: "hash", protectedSuiteHash: "suite", mode: "local", diff: "PRIVATE PATCH", note: "PRIVATE CONTRIBUTOR NOTE" });
    const query = async (slug: string, kind: "operator" | "viewer") => t.query(api.agentsConsole.overview, { actor: await mintSession(process.env.DEMO_SESSION_SECRET!, slug, 60000, kind) });
    expect(JSON.stringify(await query("harbor", "viewer"))).not.toMatch(/PRIVATE PATCH|PRIVATE CONTRIBUTOR NOTE/);
    expect((await query("northstar", "viewer")).runs[0].diff).toBe("PRIVATE PATCH");
    expect((await query("review-desk", "operator")).runs[0].diff).toBe("PRIVATE PATCH");
    delete process.env.DEMO_SESSION_SECRET;
  });

  it("a payment that fails before dispatch is marked failed and releases the budget; after signing it stays pending", async () => {
    const { t, cheap, pricey } = await setup({ maxPurchases: 1, perPurchase: "10000" });
    const q = await t.mutation(api.mcp.quote, { ...B, resolutionId: cheap });
    const ref = await t.mutation(api.mcp.acquire, { ...B, quoteId: q.quoteId, clientRequestId: "req-fail-1", approved, simulate: false });
    await t.mutation(internal.x402State.recordFailure, { purchaseId: ref.purchaseId as never, message: "Agent x402 payment failed: facilitator unreachable" });
    let o = await overview(t);
    expect(o.payments[0]).toMatchObject({ state: "failed", error: expect.stringContaining("facilitator unreachable") });
    expect(o.payments[0].allowanceNow).toMatchObject({ remainingPurchases: 1, committedAtomic: "0" });
    expect(o.events.find((e) => e.kind === "payment_failed")?.status).toBe("error");
    // Replaying the same idempotency key returns the failed purchase, never a success.
    expect(await t.mutation(api.mcp.acquire, { ...B, quoteId: q.quoteId, clientRequestId: "req-fail-1", approved, simulate: false })).toMatchObject({ status: "failed" });
    // A retry with a new key is allowed because the reservation was released.
    const q2 = await t.mutation(api.mcp.quote, { ...B, resolutionId: cheap });
    const retry = await t.mutation(api.mcp.acquire, { ...B, quoteId: q2.quoteId, clientRequestId: "req-fail-2", approved, simulate: false });
    expect(retry.purchaseId).not.toBe(ref.purchaseId);
    // Signed authorization recorded, then an error: kept pending (reconcile on-chain), budget still reserved.
    await t.mutation(internal.x402State.markSettling, { purchaseId: retry.purchaseId as never, payer: "0x1111111111111111111111111111111111111111", nonce: "0x01" });
    await t.mutation(internal.x402State.recordFailure, { purchaseId: retry.purchaseId as never, message: "settle timeout" });
    o = await overview(t);
    expect(o.payments.find((p) => p.purchaseId === retry.purchaseId)!.state).toBe("unconfirmed");
    expect(JSON.stringify(o.payments)).not.toContain("0x01\"");
    const q3 = await t.mutation(api.mcp.quote, { ...B, resolutionId: pricey });
    expect(await errCode(t.mutation(api.mcp.acquire, { ...B, quoteId: q3.quoteId, clientRequestId: "req-fail-3", approved: { ...approved, maxAmountAtomic: q3.price.amountAtomic }, simulate: false }))).toBe("BUDGET_EXCEEDED");
  });

  it("connector events are sanitized server-side and runner events follow the agent's role", async () => {
    const { t } = await setup();
    await t.mutation(api.mcp.logConnectorEvent, {
      runnerSecret: RUNNER, lane: "consumer", actor: "agent-b", kind: "search_resolutions", summary: "Found a guide", status: "ok", mode: "local",
      detail: { tool: "search_resolutions", input: [{ k: "bearer token", v: "ixa_secret_value_000000000000" }, { k: "symptoms", v: "auth=ix_canary_9fQ2kLm7Xw4Rt8Zp twice" }] },
      refs: ["not an id!", "k97abcdefghijklmnop"],
    });
    await t.mutation(api.mcp.recordRepairRun, {
      runnerSecret: RUNNER, principalName: "agent-a", repo: "repo-c", stage: "candidate", toolName: "runner", passed: true, total: 5, passedCount: 5,
      tests: [{ name: "t", ok: true }], changedFiles: [], candidateHash: "sha256:c", protectedSuiteHash: "sha256:s", mode: "local",
    });
    const events = (await overview(t)).events;
    const conn = events.find((e) => e.kind === "search_resolutions")!;
    expect(conn.detail?.input).toEqual([{ k: "symptoms", v: "[redacted: api_token]" }]);
    expect(conn.refs).toEqual(["k97abcdefghijklmnop"]);
    const run = events.find((e) => e.kind === "candidate_tests")!;
    expect(run.lane).toBe("contributor");
    expect(run.detail?.evidence?.[0].k).toBe("run");
  });
});
