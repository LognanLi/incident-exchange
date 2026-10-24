import { ConvexError, v } from "convex/values";
import { action, internalMutation, internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { getActor } from "./lib/access";
import { scorePlaybook } from "./lib/search";
import { answerFromSections } from "./lib/qa";
import { FREE_SECTIONS, SECTION_KEYS, type SectionKey } from "./lib/domain";
import { askWithMossContext, askWithMossIndex, mossCredentials, playbookIndexName } from "./lib/moss";
import type { QaAnswer } from "./lib/qa";
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

/** Sections and Moss index this viewer may query. Locked sections only for unlocked viewers. */
export const qaContext = internalQuery({
  args: { actor: v.string(), playbookId: v.id("playbooks") },
  handler: async (ctx, { actor, playbookId }) => {
    const org = await getActor(ctx, actor);
    const pb = await ctx.db.get(playbookId);
    if (!pb || !pb.active) throw new ConvexError("Playbook not found.");
    const unlocked = await hasUnlocked(ctx, org, pb);
    const scope = unlocked ? ("full" as const) : ("preview" as const);
    const allowed: SectionKey[] = unlocked ? [...SECTION_KEYS] : [...FREE_SECTIONS];
    const all: Record<SectionKey, string> = { ...pb.publicSteps, limitations: pb.publicLimitations };
    const index = await ctx.db
      .query("mossIndexes")
      .withIndex("by_playbook_scope", (q) => q.eq("playbookId", playbookId).eq("scope", scope))
      .unique();
    return {
      scope,
      allowed,
      sections: Object.fromEntries(allowed.map((k) => [k, all[k]])) as Partial<Record<SectionKey, string>>,
      indexName: playbookIndexName(playbookId, scope),
      indexStatus: index?.status ?? null,
    };
  },
});

export const recordQaEvent = internalMutation({
  args: { outcome: v.union(v.literal("success"), v.literal("failure")), message: v.string() },
  handler: async (ctx, { outcome, message }) => {
    await ctx.db.insert("integrationEvents", { integration: "moss", outcome, message, at: Date.now() });
  },
});

export type AskResult = {
  answer: string;
  citations: { section: SectionKey; title: string; excerpt?: string }[];
  grounded: boolean;
  engine: "moss_index" | "moss_context" | "fallback";
  searchedLockedSections: boolean;
  note?: string;
};

/**
 * Grounded Q&A over only the sections this viewer may read.
 * - Moss index ready for this playbook/scope → Moss Inference retrieves from it.
 * - Moss configured but no index → Moss Inference with the allowed sections supplied directly.
 *   (Indexes are built only at publish time, so questions never spend index-build quota.)
 * - Moss not configured or erroring → deterministic fallback, labeled.
 */
export const askPlaybook = action({
  args: { actor: v.string(), playbookId: v.id("playbooks"), question: v.string() },
  handler: async (ctx, { actor, playbookId, question }): Promise<AskResult> => {
    if (question.length > 500) throw new ConvexError("Question is too long.");
    if (!question.trim()) throw new ConvexError("Ask a question.");
    const qa = await ctx.runQuery(internal.playbooks.qaContext, { actor, playbookId });
    const searchedLockedSections = qa.scope === "full";
    const fallback = (note?: string): AskResult => {
      const r: QaAnswer = answerFromSections(question, qa.sections);
      return { ...r, engine: "fallback", searchedLockedSections, note };
    };
    if (!mossCredentials()) return fallback();

    try {
      const useIndex = qa.indexStatus === "ready";
      const r = useIndex
        ? await askWithMossIndex(question, qa.indexName, qa.allowed)
        : await askWithMossContext(question, qa.sections, qa.allowed);
      await ctx.runMutation(internal.playbooks.recordQaEvent, {
        outcome: "success",
        message: useIndex ? "Answered with Moss retrieval from a playbook index." : "Answered with Moss Inference from supplied sections.",
      });
      return { ...r, engine: useIndex ? "moss_index" : "moss_context", searchedLockedSections };
    } catch (err) {
      const reason = (err instanceof Error ? err.message : "unexpected error").slice(0, 160);
      await ctx.runMutation(internal.playbooks.recordQaEvent, { outcome: "failure", message: `Moss Q&A failed (${reason}); used fallback.` });
      return fallback(`Moss was unavailable (${reason}); answered with the deterministic fallback.`);
    }
  },
});
