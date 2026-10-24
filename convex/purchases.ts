import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireRole } from "./lib/access";
import { recordIntegrationEvent } from "./lib/integrations";
import { splitRevenue } from "./lib/money";

// No x402 test credentials are configured in this build, so every purchase uses the clearly
// labeled demo simulator. No funds move and nothing is "settled".

export const startCheckout = mutation({
  args: { actor: v.string(), playbookId: v.id("playbooks") },
  handler: async (ctx, { actor, playbookId }) => {
    const buyer = await requireRole(ctx, actor, "buyer");
    const pb = await ctx.db.get(playbookId);
    if (!pb || !pb.active) throw new ConvexError("Playbook not found.");
    const existing = await ctx.db
      .query("purchases")
      .withIndex("by_buyer_playbook", (q) => q.eq("buyerOrgId", buyer._id).eq("playbookId", playbookId))
      .collect();
    const done = existing.find((p) => p.paymentStatus === "simulated_success" || p.paymentStatus === "test_success");
    if (done) return done._id;
    const pending = existing.find((p) => p.paymentStatus === "pending");
    if (pending) return pending._id;

    const split = splitRevenue(pb.priceMinorUnits);
    return await ctx.db.insert("purchases", {
      buyerOrgId: buyer._id,
      playbookId,
      amountMinorUnits: pb.priceMinorUnits,
      currency: pb.currency,
      provider: "demo_simulator",
      paymentStatus: "pending",
      ...split,
      transactionReference: `DEMO-SIM-${Date.now().toString(36).toUpperCase()}`,
      isDemo: buyer.isDemo,
      createdAt: Date.now(),
    });
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
