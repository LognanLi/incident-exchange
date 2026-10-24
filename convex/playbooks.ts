import { ConvexError, v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { getActor, requireRole } from "./lib/access";
import { answerFromSections } from "./lib/qa";
import { FREE_SECTIONS, SECTION_KEYS, type SectionKey } from "./lib/domain";
import { askWithMossContext, askWithMossIndex, mossCredentials, playbookIndexName } from "./lib/moss";
import type { QaAnswer } from "./lib/qa";
import { matchGuide, RELEVANCE_INFO } from "./lib/matching";
import { evidenceLevelV } from "./schema";

const PAID = ["simulated_success", "test_success"] as const;
const isPaid = (p: Doc<"purchases">) => (PAID as readonly string[]).includes(p.paymentStatus);

/**
 * Buyer-facing projection: explicit allowlist of public preview fields from the playbooks table.
 * Paid sections live only in playbookRevisions and are read solely by entitledContent().
 */
function listing(pb: Doc<"playbooks">) {
  return {
    _id: pb._id,
    revision: pb.revision,
    publicTitle: pb.publicTitle,
    publicSummary: pb.publicSummary,
    recognize: pb.previewRecognize,
    publicLimitations: pb.publicLimitations,
    systemCategories: pb.systemCategories,
    environment: pb.environment,
    checksBeforeUse: pb.applicability.checksBeforeUse,
    mismatchSignals: pb.applicability.mismatchSignals.map((m) => ({ label: m.label, explanation: m.explanation })),
    evidenceLevel: pb.evidenceLevel,
    evidenceScope: pb.evidenceScope,
    toyCase: pb.toyCase,
    priceAtomic: pb.priceAtomic,
    currency: pb.currency,
    contributorAlias: pb.contributorAlias,
    publishedAt: pb.publishedAt,
    sourceKind: "private_contribution" as const,
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

/** The revision this viewer may read in full, or null. Buyers: their latest paid revision. */
async function entitledRevision(ctx: QueryCtx, org: Doc<"organizations">, pb: Doc<"playbooks">): Promise<number | null> {
  if (org.demoRole === "reviewer") return pb.revision;
  if (org.demoRole === "contributor") return pb.contributorOrgId === org._id ? pb.revision : null;
  const purchases = await ctx.db
    .query("purchases")
    .withIndex("by_buyer_playbook", (q) => q.eq("buyerOrgId", org._id).eq("playbookId", pb._id))
    .collect();
  const paid = purchases.filter(isPaid);
  return paid.length ? Math.max(...paid.map((p) => p.revision)) : null;
}

async function entitledContent(ctx: QueryCtx, playbookId: Id<"playbooks">, revision: number) {
  return await ctx.db
    .query("playbookRevisions")
    .withIndex("by_playbook_revision", (q) => q.eq("playbookId", playbookId).eq("revision", revision))
    .unique();
}

async function evidenceRuns(ctx: QueryCtx, pb: Doc<"playbooks">) {
  const byPlaybook = await ctx.db.query("validationRuns").withIndex("by_playbook", (q) => q.eq("playbookId", pb._id)).collect();
  const byDraft = pb.incidentDraftId
    ? await ctx.db.query("validationRuns").withIndex("by_draft", (q) => q.eq("incidentDraftId", pb.incidentDraftId!)).collect()
    : [];
  return [...byPlaybook, ...byDraft]
    .sort((a, b) => a.runAt - b.runAt)
    .map((r) => ({
      step: r.step,
      toolName: r.toolName,
      checkName: r.checkName,
      passed: r.passed,
      resultSummary: r.resultSummary,
      outputLines: r.outputLines.slice(0, 20),
      patchSummary: r.patchSummary,
      targetName: r.targetName,
      artifactRef: r.artifactRef,
      runAt: r.runAt,
    }));
}

export const search = query({
  args: {
    actor: v.string(),
    query: v.string(),
    category: v.optional(v.string()),
    evidenceLevel: v.optional(evidenceLevelV),
    maxPriceAtomic: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const org = await getActor(ctx, args.actor);
    if (args.query.length > 600) throw new ConvexError("Description is too long.");
    const active = await ctx.db.query("playbooks").withIndex("by_active", (q) => q.eq("active", true)).collect();
    const filtered = active.filter(
      (pb) =>
        (!args.category || pb.systemCategories.includes(args.category)) &&
        (!args.evidenceLevel || pb.evidenceLevel === args.evidenceLevel) &&
        (!args.maxPriceAtomic || BigInt(pb.priceAtomic) <= BigInt(args.maxPriceAtomic)),
    );
    const hasQuery = args.query.trim().length > 0;
    const rows = filtered
      .map((pb) => ({
        pb,
        m: hasQuery
          ? matchGuide(args.query, {
              publicTitle: pb.publicTitle,
              publicSummary: pb.publicSummary,
              recognize: pb.previewRecognize,
              systemCategories: pb.systemCategories,
              environment: pb.environment,
              clues: pb.applicability.clues,
              mismatchSignals: pb.applicability.mismatchSignals,
            })
          : null,
      }))
      .filter(({ m }) => !hasQuery || m !== null)
      // Ranked by symptom overlap only (price never affects order); newest first when browsing.
      .sort((a, b) => (b.m?.score ?? 0) - (a.m?.score ?? 0) || b.pb.publishedAt - a.pb.publishedAt);

    return await Promise.all(
      rows.map(async ({ pb, m }) => ({
        ...listing(pb),
        match: m && {
          ...m,
          relevance: RELEVANCE_INFO[m.relevanceLabel].label,
          relevanceExplanation: RELEVANCE_INFO[m.relevanceLabel].explanation,
        },
        feedback: await feedbackSummary(ctx, pb._id),
        unlocked: (await entitledRevision(ctx, org, pb)) !== null,
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
    const revision = await entitledRevision(ctx, org, pb);
    const content = revision !== null ? await entitledContent(ctx, pb._id, revision) : null;

    const references = pb.incidentDraftId
      ? await ctx.db.query("publicReferences").withIndex("by_draft", (q) => q.eq("incidentDraftId", pb.incidentDraftId!)).collect()
      : await ctx.db.query("publicReferences").withIndex("by_playbook", (q) => q.eq("playbookId", pb._id)).collect();

    const purchases =
      org.demoRole === "buyer"
        ? await ctx.db.query("purchases").withIndex("by_buyer_playbook", (q) => q.eq("buyerOrgId", org._id).eq("playbookId", pb._id)).collect()
        : [];
    const checklist =
      org.demoRole === "buyer"
        ? await ctx.db.query("buyerChecklists").withIndex("by_buyer_playbook", (q) => q.eq("buyerOrgId", org._id).eq("playbookId", pb._id)).unique()
        : null;

    return {
      ...listing(pb),
      unlocked: content !== null,
      entitledRevision: revision,
      newerRevisionAvailable: revision !== null && revision < pb.revision,
      lockedSteps: content && { check: content.check, contain: content.contain, recover: content.recover, verify: content.verify },
      failedAttempts: content?.failedAttempts ?? null,
      references: references.map((r) => ({
        _id: r._id,
        title: r.title,
        sourceName: r.sourceName,
        url: r.url,
        publishedAt: r.publishedAt,
        retrievedAt: r.retrievedAt,
        relevanceNote: r.relevanceNote,
        seeded: r.seeded,
        sourceType: r.sourceType,
      })),
      validationRuns: await evidenceRuns(ctx, pb),
      feedback: await feedbackSummary(ctx, pb._id),
      successfulPurchaseId: purchases.find(isPaid)?._id,
      checkedItems: checklist?.revision === revision ? checklist.checked : [],
      viewerRole: org.demoRole,
    };
  },
});

/** Buyer's own checklist progress; stored separately and never edits the guide. */
export const setChecklistItem = mutation({
  args: { actor: v.string(), playbookId: v.id("playbooks"), itemId: v.string(), checked: v.boolean() },
  handler: async (ctx, { actor, playbookId, itemId, checked }) => {
    const buyer = await requireRole(ctx, actor, "buyer");
    const pb = await ctx.db.get(playbookId);
    if (!pb) throw new ConvexError("Playbook not found.");
    const revision = await entitledRevision(ctx, buyer, pb);
    if (revision === null) throw new ConvexError("Unlock the guide to use its checklist.");
    if (itemId.length > 40) throw new ConvexError("Invalid item.");
    const existing = await ctx.db
      .query("buyerChecklists")
      .withIndex("by_buyer_playbook", (q) => q.eq("buyerOrgId", buyer._id).eq("playbookId", playbookId))
      .unique();
    const prev = existing?.revision === revision ? existing.checked : [];
    const next = checked ? [...new Set([...prev, itemId])] : prev.filter((i) => i !== itemId);
    if (existing) await ctx.db.patch(existing._id, { revision, checked: next, updatedAt: Date.now() });
    else await ctx.db.insert("buyerChecklists", { buyerOrgId: buyer._id, playbookId, revision, checked: next, isDemo: buyer.isDemo, updatedAt: Date.now() });
  },
});

/** Sections and Moss index this viewer may query. Locked sections only for unlocked viewers. */
export const qaContext = internalQuery({
  args: { actor: v.string(), playbookId: v.id("playbooks") },
  handler: async (ctx, { actor, playbookId }) => {
    const org = await getActor(ctx, actor);
    const pb = await ctx.db.get(playbookId);
    if (!pb || !pb.active) throw new ConvexError("Playbook not found.");
    const revision = await entitledRevision(ctx, org, pb);
    const content = revision !== null ? await entitledContent(ctx, pb._id, revision) : null;
    const scope = content ? ("full" as const) : ("preview" as const);
    const allowed: SectionKey[] = content ? [...SECTION_KEYS] : [...FREE_SECTIONS];
    const all: Record<SectionKey, string> = {
      recognize: pb.previewRecognize,
      limitations: pb.publicLimitations,
      check: content?.check ?? "",
      contain: content?.contain ?? "",
      recover: content?.recover ?? "",
      verify: content?.verify ?? "",
    };
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
