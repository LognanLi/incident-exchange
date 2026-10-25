import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { requireRole } from "./lib/access";
import { recordIntegrationEvent } from "./lib/integrations";
import { audit } from "./lib/audit";
import { recordAgentEvent } from "./lib/agentEvents";
import { sanitizeEventText } from "../shared/eventDetail.mjs";

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
    return { _id: p._id, x402: p.x402, paymentStatus: p.paymentStatus };
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
    const buyer = await ctx.db.get(p.buyerOrgId);
    const pb = await ctx.db.get(p.playbookId);
    await audit(ctx, buyer, "purchase.settled", pb?.publicTitle ?? "guide", `x402 Base Sepolia ${txHash ? txHash.slice(0, 12) + "…" : ""}`);
    if (p.principalId) {
      const agent = await ctx.db.get(p.principalId);
      await recordAgentEvent(ctx, {
        lane: "consumer", actor: agent?.name ?? "agent", kind: "payment_settled", status: "ok", mode: "testnet", refs: [purchaseId],
        summary: `Test payment settled on Base Sepolia${txHash ? ` (tx ${txHash.slice(0, 10)}…)` : ""}; access granted to rev ${p.revision}.`,
        detail: {
          tool: "acquire_resolution", resolutionId: p.playbookId, revision: p.revision,
          result: "test_success: settled on-chain; entitlement granted",
          evidence: [{ k: "network", v: network }, { k: "transaction", v: txHash ?? "not reported" }, { k: "payer (public address)", v: payer ?? "unknown" }, { k: "payee (public address)", v: p.x402.payTo }, { k: "amount (atomic)", v: p.x402.atomicAmount }],
        },
      });
    }
    await recordIntegrationEvent(ctx, "x402", "success", `x402 test payment settled on Base Sepolia${txHash ? ` (${txHash.slice(0, 10)}…)` : ""}.`);
  },
});

/**
 * Record the signed authorization before settling. If a different authorization is already
 * pending for this purchase, refuse: the earlier one must be reconciled first (no double charge).
 */
export const markSettling = internalMutation({
  args: { purchaseId: v.id("purchases"), payer: v.string(), nonce: v.string() },
  handler: async (ctx, { purchaseId, payer, nonce }) => {
    const p = await ctx.db.get(purchaseId);
    if (!p || !p.x402 || p.paymentStatus !== "pending") return { ok: false, reason: "not_pending" as const };
    if (p.x402.nonce && p.x402.nonce !== nonce) return { ok: false, reason: "other_authorization_pending" as const };
    await ctx.db.patch(purchaseId, { x402: { ...p.x402, payer, nonce, settlingAt: p.x402.settlingAt ?? Date.now(), error: undefined } });
    if (p.principalId && !p.x402.nonce) {
      const agent = await ctx.db.get(p.principalId);
      await recordAgentEvent(ctx, {
        lane: "consumer", actor: agent?.name ?? "agent", kind: "payment_pending", status: "pending", mode: "testnet", refs: [purchaseId],
        summary: "Test wallet authorization recorded; waiting for settlement on Base Sepolia.",
        detail: { tool: "acquire_resolution", resolutionId: p.playbookId, revision: p.revision, result: "pending settlement; allowance remains reserved", evidence: [{ k: "purchase", v: purchaseId }, { k: "network", v: p.x402.network }] },
      });
    }
    return { ok: true as const };
  },
});

/** The earlier authorization expired unused on-chain: clear it so the buyer may retry. */
export const clearSettling = internalMutation({
  args: { purchaseId: v.id("purchases") },
  handler: async (ctx, { purchaseId }) => {
    const p = await ctx.db.get(purchaseId);
    if (!p?.x402 || p.paymentStatus !== "pending") return;
    await ctx.db.patch(purchaseId, { x402: { ...p.x402, nonce: undefined, settlingAt: undefined } });
  },
});

export const recordFailure = internalMutation({
  args: { purchaseId: v.optional(v.id("purchases")), message: v.string() },
  handler: async (ctx, { purchaseId, message: rawMessage }) => {
    const message = sanitizeEventText(rawMessage, 300);
    if (purchaseId) {
      const p = await ctx.db.get(purchaseId);
      if (p?.x402 && p.paymentStatus === "pending") {
        // No authorization was ever recorded → nothing can settle later: mark failed (frees the reservation, allows a
        // retry with a new request id). With a recorded authorization it stays pending until reconciled on-chain.
        const settledLater = !!p.x402.nonce;
        await ctx.db.patch(purchaseId, { x402: { ...p.x402, error: message.slice(0, 300) }, ...(settledLater ? {} : { paymentStatus: "failed" as const, completedAt: Date.now() }) });
        if (p.principalId) {
          const agent = await ctx.db.get(p.principalId);
          await recordAgentEvent(ctx, {
            lane: "consumer", actor: agent?.name ?? "agent", kind: settledLater ? "payment_unconfirmed" : "payment_failed", status: "error", mode: "testnet", refs: [purchaseId],
            summary: settledLater
              ? "Payment error after the authorization was signed; kept pending until it is reconciled on-chain (no double charge)."
              : "Test payment failed before settlement could start; no funds moved and the budget reservation was released.",
            detail: { tool: "acquire_resolution", resolutionId: p.playbookId, revision: p.revision, result: settledLater ? "pending (reconcile)" : "failed", evidence: [{ k: "error", v: message.slice(0, 200) }, { k: "purchase", v: purchaseId }] },
          });
        }
      }
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
