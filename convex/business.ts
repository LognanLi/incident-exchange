import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { getActor, requireRole } from "./lib/access";
import { audit } from "./lib/audit";
import { matchGuide, RELEVANCE_INFO } from "./lib/matching";
import { sumAtomic } from "./lib/money";

const PAID = new Set(["simulated_success", "test_success"]);
const DEFAULT_BUDGET = "2000000"; // 2.00 test USDC / month

function monthStart(now = Date.now()): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

export async function spendThisMonth(ctx: QueryCtx, orgId: Doc<"organizations">["_id"]): Promise<string> {
  const purchases = await ctx.db.query("purchases").withIndex("by_buyer", (q) => q.eq("buyerOrgId", orgId)).collect();
  const since = monthStart();
  return sumAtomic(purchases.filter((p) => PAID.has(p.paymentStatus) && (p.completedAt ?? p.createdAt) >= since).map((p) => p.amountAtomic));
}

export async function budgetFor(ctx: QueryCtx, orgId: Doc<"organizations">["_id"]): Promise<string> {
  const policy = await ctx.db.query("spendPolicies").withIndex("by_org", (q) => q.eq("orgId", orgId)).unique();
  return policy?.monthlyBudgetAtomic ?? DEFAULT_BUDGET;
}

// ---------------------------------------------------------------- watchlist

export const listWatches = query({
  args: { actor: v.string() },
  handler: async (ctx, { actor }) => {
    const buyer = await requireRole(ctx, actor, "buyer");
    const watches = await ctx.db.query("watches").withIndex("by_buyer", (q) => q.eq("buyerOrgId", buyer._id)).collect();
    const alerts = await ctx.db.query("alerts").withIndex("by_buyer", (q) => q.eq("buyerOrgId", buyer._id)).order("desc").take(50);
    return { watches: watches.sort((a, b) => b.createdAt - a.createdAt), alerts };
  },
});

export const addWatch = mutation({
  args: { actor: v.string(), query: v.string() },
  handler: async (ctx, { actor, query: q }) => {
    const buyer = await requireRole(ctx, actor, "buyer");
    const text = q.trim();
    if (text.length < 8) throw new ConvexError("Describe the symptoms in a few more words.");
    if (text.length > 400) throw new ConvexError("Keep alerts under 400 characters.");
    const existing = await ctx.db.query("watches").withIndex("by_buyer", (x) => x.eq("buyerOrgId", buyer._id)).collect();
    if (existing.length >= 10) throw new ConvexError("You can keep up to 10 alerts.");
    if (existing.some((w) => w.query.toLowerCase() === text.toLowerCase())) throw new ConvexError("You already have this alert.");
    const id = await ctx.db.insert("watches", { buyerOrgId: buyer._id, query: text, createdAt: Date.now(), isDemo: buyer.isDemo });
    await audit(ctx, buyer, "alert.created", "Symptom alert", text.slice(0, 80));
    return id;
  },
});

export const removeWatch = mutation({
  args: { actor: v.string(), watchId: v.id("watches") },
  handler: async (ctx, { actor, watchId }) => {
    const buyer = await requireRole(ctx, actor, "buyer");
    const w = await ctx.db.get(watchId);
    if (!w || w.buyerOrgId !== buyer._id) throw new ConvexError("Alert not found.");
    await ctx.db.delete(watchId);
  },
});

export const markAlertsRead = mutation({
  args: { actor: v.string() },
  handler: async (ctx, { actor }) => {
    const buyer = await requireRole(ctx, actor, "buyer");
    const unread = (await ctx.db.query("alerts").withIndex("by_buyer", (q) => q.eq("buyerOrgId", buyer._id)).collect()).filter((a) => !a.read);
    for (const a of unread) await ctx.db.patch(a._id, { read: true });
  },
});

/** Unread alerts for the live toast (buyers only; other roles get an empty list). */
export const unreadAlerts = query({
  args: { actor: v.string() },
  handler: async (ctx, { actor }) => {
    const org = await getActor(ctx, actor).catch(() => null);
    if (!org || org.demoRole !== "buyer") return [];
    return (await ctx.db.query("alerts").withIndex("by_buyer", (q) => q.eq("buyerOrgId", org._id)).order("desc").take(10)).filter((a) => !a.read);
  },
});

// ------------------------------------------------------------- team & spend

export const teamOverview = query({
  args: { actor: v.string() },
  handler: async (ctx, { actor }) => {
    const buyer = await requireRole(ctx, actor, "buyer");
    const events = await ctx.db.query("auditEvents").withIndex("by_org", (q) => q.eq("orgId", buyer._id)).order("desc").take(30);
    return {
      org: { displayName: buyer.displayName, verified: !!buyer.verified, verifiedDomain: buyer.verifiedDomain },
      monthlyBudgetAtomic: await budgetFor(ctx, buyer._id),
      spentThisMonthAtomic: await spendThisMonth(ctx, buyer._id),
      events,
    };
  },
});

export const setBudget = mutation({
  args: { actor: v.string(), monthlyBudgetAtomic: v.string() },
  handler: async (ctx, { actor, monthlyBudgetAtomic }) => {
    const buyer = await requireRole(ctx, actor, "buyer");
    if (!/^\d+$/.test(monthlyBudgetAtomic) || BigInt(monthlyBudgetAtomic) > 100_000_000n) throw new ConvexError("Enter a budget up to 100 USDC.");
    const policy = await ctx.db.query("spendPolicies").withIndex("by_org", (q) => q.eq("orgId", buyer._id)).unique();
    if (policy) await ctx.db.patch(policy._id, { monthlyBudgetAtomic });
    else await ctx.db.insert("spendPolicies", { orgId: buyer._id, monthlyBudgetAtomic, isDemo: buyer.isDemo });
    await audit(ctx, buyer, "budget.updated", "Monthly guide budget", `${monthlyBudgetAtomic} atomic USDC`);
    return { ok: true };
  },
});

// ---------------------------------------------------------------- audit log

export const auditLog = query({
  args: { actor: v.string() },
  handler: async (ctx, { actor }) => {
    await requireRole(ctx, actor, "reviewer");
    return await ctx.db.query("auditEvents").withIndex("by_at").order("desc").take(100);
  },
});

// ------------------------------------------------------------ public stats

/** Aggregate, non-identifying marketplace numbers for the landing page. */
export const marketStats = query({
  args: {},
  handler: async (ctx) => {
    const playbooks = await ctx.db.query("playbooks").withIndex("by_active", (q) => q.eq("active", true)).collect();
    const runs = await ctx.db.query("validationRuns").collect();
    const feedback = await ctx.db.query("outcomeFeedback").collect();
    return {
      guides: playbooks.length,
      reproduced: playbooks.filter((p) => p.evidenceLevel === "test_reproduced").length,
      testRuns: runs.filter((r) => r.step !== "fix").length,
      outcomes: feedback.length,
    };
  },
});

export { RELEVANCE_INFO, matchGuide };
