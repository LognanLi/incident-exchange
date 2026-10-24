import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireRole } from "./lib/access";
import { recordIntegrationEvent } from "./lib/integrations";
import { splitRevenue } from "./lib/money";
import { audit } from "./lib/audit";
import { LICENSE_VERSION } from "./lib/license";
import { budgetFor, spendThisMonth } from "./business";
import { USDC_BASE_SEPOLIA, X402_NETWORK, cdpCredentialsPresent } from "./lib/x402";

// Purchases use Coinbase x402 on Base Sepolia (test USDC) when CDP credentials are set and the
// wallet setup has run; otherwise the clearly labeled demo simulator. No real funds ever move.

export const startCheckout = mutation({
  args: {
    actor: v.string(),
    playbookId: v.id("playbooks"),
    /** "auto" = x402 when ready, else simulator. The buyer may explicitly choose the simulator. */
    preference: v.optional(v.union(v.literal("auto"), v.literal("demo_simulator"))),
    /** The buyer must accept the Data Use License before any checkout starts. */
    acceptLicense: v.optional(v.boolean()),
  },
  handler: async (ctx, { actor, playbookId, preference, acceptLicense }) => {
    const buyer = await requireRole(ctx, actor, "buyer");
    const pb = await ctx.db.get(playbookId);
    if (!pb || !pb.active) throw new ConvexError("Playbook not found.");
    if (pb.tlp === "amber" && !buyer.verified) throw new ConvexError("This TLP:AMBER guide is sold only to verified organizations.");
    const existing = await ctx.db
      .query("purchases")
      .withIndex("by_buyer_playbook", (q) => q.eq("buyerOrgId", buyer._id).eq("playbookId", playbookId))
      .collect();
    const done = existing.find((p) => p.paymentStatus === "simulated_success" || p.paymentStatus === "test_success");
    if (done) return done._id;

    if (!acceptLicense) throw new ConvexError("Accept the Data Use License to continue.");
    const spent = BigInt(await spendThisMonth(ctx, buyer._id));
    const budget = BigInt(await budgetFor(ctx, buyer._id));
    if (spent + BigInt(pb.priceAtomic) > budget) {
      throw new ConvexError("This purchase would exceed your team's monthly guide budget. Raise it under Team & budget.");
    }

    const receiver = await ctx.db.query("x402Wallets").withIndex("by_role", (q) => q.eq("role", "receiver")).unique();
    const useX402 = preference !== "demo_simulator" && cdpCredentialsPresent() && !!receiver;
    const provider = useX402 ? ("x402_test" as const) : ("demo_simulator" as const);

    // Reuse a pending checkout with the same provider; cancel pending ones with another provider.
    for (const p of existing.filter((p) => p.paymentStatus === "pending")) {
      if (p.provider === provider) return p._id;
      await ctx.db.patch(p._id, { paymentStatus: "cancelled" });
    }

    // Bound to the exact revision, amount, network, and beneficiary at checkout time.
    const split = splitRevenue(pb.priceAtomic);
    return await ctx.db.insert("purchases", {
      buyerOrgId: buyer._id,
      playbookId,
      revision: pb.revision,
      amountAtomic: pb.priceAtomic,
      currency: pb.currency,
      provider,
      paymentStatus: "pending",
      ...split,
      transactionReference: `${useX402 ? "X402" : "DEMO-SIM"}-${Date.now().toString(36).toUpperCase()}`,
      licenseVersion: LICENSE_VERSION,
      licenseAcceptedAt: Date.now(),
      x402: useX402
        ? {
            network: X402_NETWORK,
            asset: USDC_BASE_SEPOLIA,
            atomicAmount: pb.priceAtomic,
            payTo: receiver!.address,
          }
        : undefined,
      isDemo: buyer.isDemo,
      createdAt: Date.now(),
    });
  },
});

/** Whether x402 test payments are available (for the checkout UI). */
export const paymentOptions = query({
  args: {},
  handler: async (ctx) => {
    const receiver = await ctx.db.query("x402Wallets").withIndex("by_role", (q) => q.eq("role", "receiver")).unique();
    const buyer = await ctx.db.query("x402Wallets").withIndex("by_role", (q) => q.eq("role", "buyer")).unique();
    return {
      x402Ready: cdpCredentialsPresent() && !!receiver && !!buyer,
      credentialsPresent: cdpCredentialsPresent(),
      walletsReady: !!receiver && !!buyer,
      buyerAddress: buyer?.address,
      receiverAddress: receiver?.address,
    };
  },
});

export const get = query({
  args: { actor: v.string(), purchaseId: v.id("purchases") },
  handler: async (ctx, { actor, purchaseId }) => {
    const buyer = await requireRole(ctx, actor, "buyer");
    const p = await ctx.db.get(purchaseId);
    if (!p || p.buyerOrgId !== buyer._id) return null;
    const pb = await ctx.db.get(p.playbookId);
    return {
      ...p,
      playbookTitle: pb?.publicTitle ?? "(removed)",
      contributorAlias: pb?.contributorAlias ?? "",
      evidenceLevel: pb?.evidenceLevel,
    };
  },
});

/** The buyer explicitly completes the simulator step. Only then is the playbook unlocked. */
export const completeSimulated = mutation({
  args: { actor: v.string(), purchaseId: v.id("purchases"), confirmed: v.boolean() },
  handler: async (ctx, { actor, purchaseId, confirmed }) => {
    const buyer = await requireRole(ctx, actor, "buyer");
    const p = await ctx.db.get(purchaseId);
    if (!p || p.buyerOrgId !== buyer._id) throw new ConvexError("Purchase not found.");
    if (p.paymentStatus !== "pending") throw new ConvexError("This checkout is no longer pending.");
    if (p.provider !== "demo_simulator") throw new ConvexError("Wrong payment provider.");
    if (!confirmed) throw new ConvexError("Confirm the simulated payment step.");
    await ctx.db.patch(purchaseId, { paymentStatus: "simulated_success", completedAt: Date.now() });
    const pb = await ctx.db.get(p.playbookId);
    await audit(ctx, buyer, "purchase.simulated", pb?.publicTitle ?? "guide", "Demo payment simulator (no funds moved)");
    await recordIntegrationEvent(ctx, "x402", "fallback", "Purchase completed with the demo payment simulator (x402 not configured).");
    return { ok: true };
  },
});

export const cancel = mutation({
  args: { actor: v.string(), purchaseId: v.id("purchases") },
  handler: async (ctx, { actor, purchaseId }) => {
    const buyer = await requireRole(ctx, actor, "buyer");
    const p = await ctx.db.get(purchaseId);
    if (!p || p.buyerOrgId !== buyer._id) throw new ConvexError("Purchase not found.");
    if (p.paymentStatus !== "pending") throw new ConvexError("Only pending checkouts can be cancelled.");
    await ctx.db.patch(purchaseId, { paymentStatus: "cancelled" });
    return { ok: true };
  },
});

export const listMine = query({
  args: { actor: v.string() },
  handler: async (ctx, { actor }) => {
    const buyer = await requireRole(ctx, actor, "buyer");
    const all = await ctx.db.query("purchases").withIndex("by_buyer", (q) => q.eq("buyerOrgId", buyer._id)).order("desc").collect();
    return await Promise.all(
      all.map(async (p) => ({ ...p, playbookTitle: (await ctx.db.get(p.playbookId))?.publicTitle ?? "(removed)" })),
    );
  },
});
