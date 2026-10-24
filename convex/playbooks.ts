import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { getActor } from "./lib/access";
import { scorePlaybook } from "./lib/search";
import { answerFromSections } from "./lib/qa";
import type { SectionKey } from "./lib/domain";
import { evidenceLevelV } from "./schema";

/**
 * Buyer-facing projection. Built only from the playbooks table, which never contains
 * private contributor notes, evidence files, or identifying terms.
 */
function listing(pb: Doc<"playbooks">) {
  return {
    _id: pb._id,
    publicTitle: pb.publicTitle,
    publicSummary: pb.publicSummary,
    recognize: pb.publicSteps.recognize,
    publicLimitations: pb.publicLimitations,
    systemCategories: pb.systemCategories,
    evidenceLevel: pb.evidenceLevel,
    priceMinorUnits: pb.priceMinorUnits,
    currency: pb.currency,
    contributorAlias: pb.contributorAlias,
    publishedAt: pb.publishedAt,
    sourceCategory: pb.incidentDraftId ? "Contributor incident report" : "Contributor incident report (catalog)",
  };
}

async function feedbackSummary(ctx: QueryCtx, playbookId: Id<"playbooks">) {
  const fb = await ctx.db.query("outcomeFeedback").withIndex("by_playbook", (q) => q.eq("playbookId", playbookId)).collect();
  return {
    count: fb.length,
    resolved: fb.filter((f) => f.outcome === "resolved").length,
    partiallyResolved: fb.filter((f) => f.outcome === "partially_resolved").length,
  };
}

async function hasUnlocked(ctx: QueryCtx, org: Doc<"organizations">, pb: Doc<"playbooks">): Promise<boolean> {
  if (org.demoRole === "reviewer") return true;
  if (org.demoRole === "contributor") return pb.contributorOrgId === org._id;
  const purchases = await ctx.db
    .query("purchases")
    .withIndex("by_buyer_playbook", (q) => q.eq("buyerOrgId", org._id).eq("playbookId", pb._id))
    .collect();
  return purchases.some((p) => p.paymentStatus === "simulated_success" || p.paymentStatus === "test_success");
}

export const search = query({
  args: {
    actor: v.string(),
    query: v.string(),
    category: v.optional(v.string()),
    evidenceLevel: v.optional(evidenceLevelV),
    maxPriceMinorUnits: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const org = await getActor(ctx, args.actor);
    if (args.query.length > 500) throw new ConvexError("Search text is too long.");
    const active = await ctx.db.query("playbooks").withIndex("by_active", (q) => q.eq("active", true)).collect();
    const filtered = active.filter(
      (pb) =>
        (!args.category || pb.systemCategories.includes(args.category)) &&
        (!args.evidenceLevel || pb.evidenceLevel === args.evidenceLevel) &&
        (args.maxPriceMinorUnits === undefined || pb.priceMinorUnits <= args.maxPriceMinorUnits),
    );
    const hasQuery = args.query.trim().length > 0;
    const scored = filtered
      .map((pb) => {
        const m = hasQuery
          ? scorePlaybook(args.query, { ...pb, recognize: pb.publicSteps.recognize })
          : { score: 0, reason: "", matchedTerms: [] };
        return { pb, m };
      })
      .filter(({ m }) => !hasQuery || m.score > 0)
      .sort((a, b) => b.m.score - a.m.score || b.pb.publishedAt - a.pb.publishedAt);

    return await Promise.all(
      scored.map(async ({ pb, m }) => ({
        ...listing(pb),
        matchScore: m.score,
        matchReason: m.reason,
        feedback: await feedbackSummary(ctx, pb._id),
        unlocked: await hasUnlocked(ctx, org, pb),
      })),
    );
  },
});

export const get = query({
  args: { actor: v.string(), playbookId: v.id("playbooks") },
  handler: async (ctx, { actor, playbookId }) => {
    const org = await getActor(ctx, actor);
    const pb = await ctx.db.get(playbookId);
    if (!pb || (!pb.active && org.demoRole === "buyer")) return null;
    const unlocked = await hasUnlocked(ctx, org, pb);

    const references = pb.incidentDraftId
      ? (await ctx.db.query("publicReferences").withIndex("by_draft", (q) => q.eq("incidentDraftId", pb.incidentDraftId!)).collect()).map(
          (r) => ({ _id: r._id, title: r.title, sourceName: r.sourceName, url: r.url, publishedAt: r.publishedAt, retrievedAt: r.retrievedAt, relevanceNote: r.relevanceNote, seeded: r.seeded }),
        )
      : [];
    const runs = pb.incidentDraftId
      ? (await ctx.db.query("validationRuns").withIndex("by_draft", (q) => q.eq("incidentDraftId", pb.incidentDraftId!)).collect())
          .sort((a, b) => a.runAt - b.runAt)
          .map((r) => ({ step: r.step, toolName: r.toolName, checkName: r.checkName, passed: r.passed, resultSummary: r.resultSummary, targetName: r.targetName, runAt: r.runAt }))
      : [];

    const purchases =
      org.demoRole === "buyer"
        ? await ctx.db.query("purchases").withIndex("by_buyer_playbook", (q) => q.eq("buyerOrgId", org._id).eq("playbookId", pb._id)).collect()
        : [];

    return {
      ...listing(pb),
      unlocked,
      lockedSteps: unlocked
        ? { check: pb.publicSteps.check, contain: pb.publicSteps.contain, recover: pb.publicSteps.recover, verify: pb.publicSteps.verify }
        : null,
      references,
      validationRuns: runs,
      feedback: await feedbackSummary(ctx, pb._id),
      successfulPurchaseId: purchases.find((p) => p.paymentStatus === "simulated_success" || p.paymentStatus === "test_success")?._id,
      viewerRole: org.demoRole,
    };
  },
});

/** Grounded Q&A over the sections this viewer may read. Never uses private contributor notes. */
export const ask = mutation({
  args: { actor: v.string(), playbookId: v.id("playbooks"), question: v.string() },
  handler: async (ctx, { actor, playbookId, question }) => {
    const org = await getActor(ctx, actor);
    if (question.length > 500) throw new ConvexError("Question is too long.");
    const pb = await ctx.db.get(playbookId);
    if (!pb || !pb.active) throw new ConvexError("Playbook not found.");
    const unlocked = await hasUnlocked(ctx, org, pb);
    const sections: Partial<Record<SectionKey, string>> = {
      recognize: pb.publicSteps.recognize,
      limitations: pb.publicLimitations,
      ...(unlocked
        ? { check: pb.publicSteps.check, contain: pb.publicSteps.contain, recover: pb.publicSteps.recover, verify: pb.publicSteps.verify }
        : {}),
    };
    return { ...answerFromSections(question, sections), engine: "fallback" as const, searchedLockedSections: unlocked };
  },
});
