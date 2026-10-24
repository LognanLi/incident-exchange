import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { requireRole } from "./lib/access";
import { recordIntegrationEvent } from "./lib/integrations";

export const getWallets = internalQuery({
  args: {},
  handler: async (ctx) => {
    const buyer = await ctx.db.query("x402Wallets").withIndex("by_role", (q) => q.eq("role", "buyer")).unique();
    const receiver = await ctx.db.query("x402Wallets").withIndex("by_role", (q) => q.eq("role", "receiver")).unique();
    return { buyer, receiver };
  },
});

export const saveWallet = internalMutation({
  args: { role: v.union(v.literal("buyer"), v.literal("receiver")), accountName: v.string(), address: v.string(), network: v.string() },
  handler: async (ctx, args) => {
    if (!/^0x[0-9a-fA-F]{40}$/.test(args.address)) throw new ConvexError("Invalid wallet address.");
    const existing = await ctx.db.query("x402Wallets").withIndex("by_role", (q) => q.eq("role", args.role)).unique();
    if (existing) await ctx.db.patch(existing._id, { ...args, updatedAt: Date.now() });
    else await ctx.db.insert("x402Wallets", { ...args, updatedAt: Date.now() });
  },
});

/** Seller side: a pending x402 purchase and what it must be paid with. Null if not payable. */
export const purchaseForSeller = internalQuery({
  args: { purchaseId: v.string() },
  handler: async (ctx, { purchaseId }) => {
    const id = ctx.db.normalizeId("purchases", purchaseId);
    if (!id) return null;
    const p = await ctx.db.get(id);
    if (!p || p.provider !== "x402_test" || p.paymentStatus !== "pending" || !p.x402) return null;
    const pb = await ctx.db.get(p.playbookId);
    return { _id: p._id, x402: p.x402, playbookTitle: pb?.publicTitle ?? "Incident Exchange playbook" };
  },
});

/** Buyer side: the acting buyer owns this pending x402 purchase. */
export const purchaseForBuyer = internalQuery({
  args: { actor: v.string(), purchaseId: v.id("purchases") },
  handler: async (ctx, { actor, purchaseId }) => {
    const buyer = await requireRole(ctx, actor, "buyer");
    const p = await ctx.db.get(purchaseId);
    if (!p || p.buyerOrgId !== buyer._id) throw new ConvexError("Purchase not found.");
    if (p.provider !== "x402_test" || !p.x402) throw new ConvexError("This checkout does not use x402.");
    if (p.paymentStatus !== "pending") throw new ConvexError("This checkout is no longer pending.");
    return { _id: p._id, x402: p.x402 };
  },
});

export const recordSuccess = internalMutation({
  args: { purchaseId: v.id("purchases"), payer: v.optional(v.string()), txHash: v.optional(v.string()), network: v.string() },
  handler: async (ctx, { purchaseId, payer, txHash, network }) => {
    const p = await ctx.db.get(purchaseId);
    if (!p || !p.x402) throw new ConvexError("Purchase not found.");
    if (p.paymentStatus !== "pending") return; // idempotent
    if (network !== p.x402.network) throw new ConvexError("Settled on an unexpected network.");
    await ctx.db.patch(purchaseId, {
      paymentStatus: "test_success",
      completedAt: Date.now(),
      transactionReference: txHash ?? p.transactionReference,
      x402: { ...p.x402, payer, txHash, error: undefined },
    });
    await recordIntegrationEvent(ctx, "x402", "success", `x402 test payment settled on Base Sepolia${txHash ? ` (${txHash.slice(0, 10)}…)` : ""}.`);
  },
});

export const recordFailure = internalMutation({
  args: { purchaseId: v.optional(v.id("purchases")), message: v.string() },
  handler: async (ctx, { purchaseId, message }) => {
    if (purchaseId) {
      const p = await ctx.db.get(purchaseId);
      if (p?.x402 && p.paymentStatus === "pending") await ctx.db.patch(purchaseId, { x402: { ...p.x402, error: message.slice(0, 300) } });
    }
    await recordIntegrationEvent(ctx, "x402", "failure", message);
  },
});

export const recordSetup = internalMutation({
  args: { message: v.string() },
  handler: async (ctx, { message }) => {
    await recordIntegrationEvent(ctx, "x402", "success", message);
  },
});
