// "Connect your agent": the current organization's agent principals, their spend policy and what they have
// used. Never returns token hashes or any credential material.
import { v } from "convex/values";
import { query, type QueryCtx } from "./_generated/server";
import { getActor } from "./lib/access";
import { sumAtomic } from "./lib/money";

async function forOrgHandler(ctx: QueryCtx, { actor }: { actor: string }) {
  const org = await getActor(ctx, actor);
  // agentPrincipals has no orgSlug index; the table is small (operator-issued, a handful per org).
  const principals = (await ctx.db.query("agentPrincipals").collect()).filter((p) => p.orgSlug === org.slug);
  const agents = [];
  for (const p of principals) {
    const purchases = await ctx.db.query("purchases").withIndex("by_principal", (q) => q.eq("principalId", p._id)).collect();
    const testnet = purchases.filter((x) => x.paymentStatus === "test_success");
    const simulated = purchases.filter((x) => x.paymentStatus === "simulated_success");
    agents.push({
      _id: p._id,
      name: p.name,
      scopes: p.scopes,
      expiresAt: p.expiresAt,
      revoked: p.revoked,
      createdAt: p.createdAt,
      lastSeenAt: p.lastSeenAt ?? null,
      lastSeenVia: p.lastSeenVia ?? null,
      policy: {
        maxPerPurchaseAtomic: p.policy.maxPerPurchaseAtomic,
        sessionMaxAtomic: p.policy.sessionMaxAtomic,
        maxPurchases: p.policy.maxPurchases,
        network: p.policy.network,
        allowSimulator: p.policy.allowSimulator ?? false,
      },
      /** Settled x402 test payments (Base Sepolia test USDC). */
      testnet: { purchases: testnet.length, spentAtomic: sumAtomic(testnet.map((x) => x.amountAtomic)) },
      /** Simulator purchases: no funds moved. Reported separately, never added to spend. */
      simulated: { purchases: simulated.length, amountAtomic: sumAtomic(simulated.map((x) => x.amountAtomic)) },
    });
  }
  agents.sort((a, b) => a.name.localeCompare(b.name));
  return { org: { slug: org.slug, displayName: org.displayName, role: org.demoRole }, agents };
}

export type AgentAccess = Awaited<ReturnType<typeof forOrgHandler>>;

export const forOrg = query({
  args: { actor: v.string() },
  handler: forOrgHandler,
});
