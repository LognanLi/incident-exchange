/// <reference types="vite/client" />
// agentAccess.forOrg: an organization sees only its own agent principals, never token hashes.
import { convexTest } from "convex-test";
import { anyApi, type FunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";
import { api, internal } from "../convex/_generated/api";
import schema from "../convex/schema";
import type { AgentAccess } from "../convex/agentAccess";
import type { Id } from "../convex/_generated/dataModel";

const modules = import.meta.glob("../convex/**/*.*s");
// Referenced by name so the test does not depend on regenerated API types.
const forOrg = anyApi.agentAccess.forOrg as FunctionReference<"query", "public", { actor: string }, AgentAccess>;
const HASHES = { b: "a".repeat(64), c: "b".repeat(64), a: "c".repeat(64) };

async function setup() {
  const t = convexTest(schema, modules);
  await t.mutation(api.demo.reset, { actor: "review-desk" });
  const policy = (max: string, n: number) => ({ maxPerPurchaseAtomic: max, sessionMaxAtomic: String(Number(max) * n), maxPurchases: n, network: "eip155:84532", allowSimulator: true });
  await t.mutation(internal.mcp.upsertPrincipal, { name: "agent-a", orgSlug: "northstar", scopes: ["search", "submit"], tokenHash: HASHES.a, ttlDays: 1, policy: policy("0", 0) });
  await t.mutation(internal.mcp.upsertPrincipal, { name: "agent-b", orgSlug: "harbor", scopes: ["search", "quote", "acquire"], tokenHash: HASHES.b, ttlDays: 1, policy: policy("10000", 3) });
  await t.mutation(internal.mcp.upsertPrincipal, { name: "agent-c", orgSlug: "harbor", scopes: ["search"], tokenHash: HASHES.c, ttlDays: 1, policy: policy("10000", 1) });
  return t;
}

async function addPurchase(t: Awaited<ReturnType<typeof setup>>, principalName: string, status: "test_success" | "simulated_success" | "pending" | "cancelled", amountAtomic: string) {
  await t.run(async (ctx) => {
    const p = (await ctx.db.query("agentPrincipals").withIndex("by_name", (q) => q.eq("name", principalName)).unique())!;
    const org = (await ctx.db.query("organizations").withIndex("by_slug", (q) => q.eq("slug", p.orgSlug)).unique())!;
    const pb = (await ctx.db.query("playbooks").first())!;
    await ctx.db.insert("purchases", {
      buyerOrgId: org._id, playbookId: pb._id as Id<"playbooks">, revision: 1, amountAtomic, currency: "USDC",
      provider: status === "simulated_success" ? "demo_simulator" : "x402_test", paymentStatus: status,
      contributorShareAtomic: "0", platformShareAtomic: amountAtomic, transactionReference: `ref-${Math.random()}`,
      principalId: p._id, isDemo: true, createdAt: Date.now(),
    });
  });
}

describe("agentAccess.forOrg", () => {
  it("returns only the caller's org principals, without token hashes", async () => {
    const t = await setup();
    const harbor = await t.query(forOrg, { actor: "harbor" });
    expect(harbor.org.slug).toBe("harbor");
    expect(harbor.agents.map((a) => a.name)).toEqual(["agent-b", "agent-c"]);
    const serialized = JSON.stringify(harbor);
    expect(serialized).not.toContain("tokenHash");
    for (const h of Object.values(HASHES)) expect(serialized).not.toContain(h);

    const northstar = await t.query(forOrg, { actor: "northstar" });
    expect(northstar.agents.map((a) => a.name)).toEqual(["agent-a"]);
    const review = await t.query(forOrg, { actor: "review-desk" });
    expect(review.agents).toEqual([]);
  });

  it("counts settled testnet purchases and reports simulated ones separately", async () => {
    const t = await setup();
    await addPurchase(t, "agent-b", "test_success", "10000");
    await addPurchase(t, "agent-b", "test_success", "5000");
    await addPurchase(t, "agent-b", "simulated_success", "10000");
    await addPurchase(t, "agent-b", "pending", "10000");
    await addPurchase(t, "agent-b", "cancelled", "10000");
    await addPurchase(t, "agent-c", "test_success", "7000");
    const { agents } = await t.query(forOrg, { actor: "harbor" });
    const b = agents.find((a) => a.name === "agent-b")!;
    expect(b.testnet).toEqual({ purchases: 2, spentAtomic: "15000" });
    expect(b.simulated).toEqual({ purchases: 1, amountAtomic: "10000" });
    expect(b.policy).toMatchObject({ maxPerPurchaseAtomic: "10000", sessionMaxAtomic: "30000", maxPurchases: 3, allowSimulator: true });
    expect(b.lastSeenAt).toBeNull();
    expect(b.lastSeenVia).toBeNull();
    expect(agents.find((a) => a.name === "agent-c")!.testnet).toEqual({ purchases: 1, spentAtomic: "7000" });
  });

  it("reports the last verified connection", async () => {
    const t = await setup();
    await t.run(async (ctx) => {
      const p = (await ctx.db.query("agentPrincipals").withIndex("by_name", (q) => q.eq("name", "agent-b")).unique())!;
      await ctx.db.patch(p._id, { lastSeenAt: 1234, lastSeenVia: "remote" });
    });
    const { agents } = await t.query(forOrg, { actor: "harbor" });
    expect(agents.find((a) => a.name === "agent-b")).toMatchObject({ lastSeenAt: 1234, lastSeenVia: "remote" });
  });

  it("rejects an unknown identity", async () => {
    const t = await setup();
    await expect(t.query(forOrg, { actor: "nobody-here" })).rejects.toThrow();
  });
});
