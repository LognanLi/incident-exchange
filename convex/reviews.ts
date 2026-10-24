import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { requireRole } from "./lib/access";
import { SECTION_KEYS, type EvidenceLevel } from "./lib/domain";
import { draftContentHash } from "./lib/draftContent";
import { evidenceLevelV } from "./schema";

const checklistV = v.object({
  sixSectionsComplete: v.boolean(),
  noSensitiveData: v.boolean(),
  defensiveOnly: v.boolean(),
  evidenceSupportsLabel: v.boolean(),
  limitationsStated: v.boolean(),
});

/** "Test reproduced" requires a recorded failing check before the fix and a passing check after it. */
export async function hasReproducedTest(ctx: QueryCtx, draftId: Id<"incidentDrafts">): Promise<boolean> {
  const runs = await ctx.db
    .query("validationRuns")
    .withIndex("by_draft", (q) => q.eq("incidentDraftId", draftId))
    .collect();
  runs.sort((a, b) => a.runAt - b.runAt);
  const failedBefore = runs.findIndex((r) => r.step === "before" && r.passed === false);
  if (failedBefore === -1) return false;
  const fix = runs.findIndex((r, i) => i > failedBefore && r.step === "fix");
  if (fix === -1) return false;
  return runs.some((r, i) => i > fix && r.step === "after" && r.passed === true);
}

async function assertEvidenceAllowed(ctx: QueryCtx, draftId: Id<"incidentDrafts">, level: EvidenceLevel) {
  if (level === "test_reproduced" && !(await hasReproducedTest(ctx, draftId))) {
    throw new ConvexError("“Test reproduced” requires a failing check before the fix and a passing check after it.");
  }
}

/** Reviewer-safe view of a draft: never includes privateNotes or identifyingTerms. */
function reviewerView(d: Doc<"incidentDrafts">) {
  return {
    _id: d._id,
    publicTitle: d.publicTitle,
    sanitizedSummary: d.sanitizedSummary,
    systemCategories: d.systemCategories,
    sharingLevel: d.sharingLevel,
    priceAtomic: d.priceAtomic,
    failedAttempts: d.failedAttempts,
    environment: d.environment,
    applicability: d.applicability,
    evidenceScope: d.evidenceScope,
    toyCase: d.toyCase,
    revision: d.revision,
    currency: d.currency,
    sections: d.sections,
    draftEngine: d.draftEngine,
    evidenceSummary: d.evidenceSummary,
    privacyFindings: d.privacyFindings,
    privacyScannedAt: d.privacyScannedAt,
    contributorApproval: d.contributorApproval,
    status: d.status,
    reviewerNote: d.reviewerNote,
    evidenceLevel: d.evidenceLevel,
    playbookId: d.playbookId,
    updatedAt: d.updatedAt,
  };
}

export const queue = query({
  args: { actor: v.string() },
  handler: async (ctx, { actor }) => {
    await requireRole(ctx, actor, "reviewer");
    const pending = await ctx.db.query("incidentDrafts").withIndex("by_status", (q) => q.eq("status", "submitted")).collect();
    const decided: Doc<"incidentDrafts">[] = [];
    for (const status of ["approved", "changes_requested", "rejected", "published"] as const) {
      decided.push(...(await ctx.db.query("incidentDrafts").withIndex("by_status", (q) => q.eq("status", status)).collect()));
    }
    const summarize = (d: Doc<"incidentDrafts">) => ({
      _id: d._id,
      publicTitle: d.publicTitle,
      status: d.status,
      systemCategories: d.systemCategories,
      highFindings: d.privacyFindings.filter((f) => f.severity === "high").length,
      evidenceLevel: d.evidenceLevel,
      updatedAt: d.updatedAt,
    });
    return {
      pending: pending.sort((a, b) => a.updatedAt - b.updatedAt).map(summarize),
      decided: decided.sort((a, b) => b.updatedAt - a.updatedAt).map(summarize),
    };
  },
});

export const getForReview = query({
  args: { actor: v.string(), draftId: v.id("incidentDrafts") },
  handler: async (ctx, { actor, draftId }) => {
    await requireRole(ctx, actor, "reviewer");
    const draft = await ctx.db.get(draftId);
    if (!draft) throw new ConvexError("Draft not found.");
    const reviews = await ctx.db.query("reviews").withIndex("by_draft", (q) => q.eq("incidentDraftId", draftId)).order("desc").collect();
    const references = await ctx.db.query("publicReferences").withIndex("by_draft", (q) => q.eq("incidentDraftId", draftId)).collect();
    const sectionsComplete = !!draft.sections && SECTION_KEYS.every((k) => draft.sections![k].body.trim() && draft.sections![k].accepted);
    return {
      draft: reviewerView(draft),
      reviews,
      references,
      approvalIsCurrent: draft.contributorApproval?.contentHash === draftContentHash(draft),
      reproduced: await hasReproducedTest(ctx, draftId),
      autoChecks: {
        sixSectionsComplete: sectionsComplete,
        noHighPrivacyFindings: !draft.privacyFindings.some((f) => f.severity === "high"),
        limitationsStated: !!draft.sections?.limitations.body.trim(),
        hasReferences: references.length > 0,
      },
    };
  },
});

export const decide = mutation({
  args: {
    actor: v.string(),
    draftId: v.id("incidentDrafts"),
    decision: v.union(v.literal("approve"), v.literal("request_changes"), v.literal("reject")),
    note: v.string(),
    evidenceLevel: v.optional(evidenceLevelV),
    checklist: checklistV,
    sectionKey: v.optional(v.string()),
  },
  handler: async (ctx, { actor, draftId, decision, note, evidenceLevel, checklist, sectionKey }) => {
    const reviewer = await requireRole(ctx, actor, "reviewer");
    const draft = await ctx.db.get(draftId);
    if (!draft) throw new ConvexError("Draft not found.");
    if (draft.status !== "submitted") throw new ConvexError("Only drafts awaiting review can be decided.");
    if (note.length > 2000) throw new ConvexError("Note is too long.");

    if (decision === "approve") {
      if (!evidenceLevel) throw new ConvexError("Choose an evidence label before approving.");
      if (!Object.values(checklist).every(Boolean)) throw new ConvexError("Complete every checklist item before approving.");
      if (draft.privacyFindings.some((f) => f.severity === "high")) throw new ConvexError("High-severity privacy findings remain.");
      if (draft.contributorApproval?.contentHash !== draftContentHash(draft)) {
        throw new ConvexError("The contributor's approval does not match the current content.");
      }
      await assertEvidenceAllowed(ctx, draftId, evidenceLevel);
    } else if (!note.trim()) {
      throw new ConvexError("Add a reason for the contributor.");
    }

    await ctx.db.insert("reviews", {
      incidentDraftId: draftId,
      reviewerOrgId: reviewer._id,
      checklist,
      decision,
      evidenceLevel: decision === "approve" ? evidenceLevel : undefined,
      note: note.trim(),
      sectionKey: decision === "request_changes" ? sectionKey : undefined,
      revision: draft.contributorApproval?.revision ?? draft.revision,
      contentHash: draft.contributorApproval?.contentHash ?? draftContentHash(draft),
      isDemo: draft.isDemo,
      createdAt: Date.now(),
    });
    await ctx.db.patch(draftId, {
      status: decision === "approve" ? "approved" : decision === "reject" ? "rejected" : "changes_requested",
      evidenceLevel: decision === "approve" ? evidenceLevel : draft.evidenceLevel,
      reviewerNote: note.trim() || undefined,
      updatedAt: Date.now(),
    });
  },
});

/** Change the evidence label of an approved or published guide (e.g. after a validation run). */
export const setEvidenceLevel = mutation({
  args: { actor: v.string(), draftId: v.id("incidentDrafts"), evidenceLevel: evidenceLevelV },
  handler: async (ctx, { actor, draftId, evidenceLevel }) => {
    await requireRole(ctx, actor, "reviewer");
    const draft = await ctx.db.get(draftId);
    if (!draft) throw new ConvexError("Draft not found.");
    if (draft.status !== "approved" && draft.status !== "published") {
      throw new ConvexError("Set the label through the review decision for drafts in review.");
    }
    await assertEvidenceAllowed(ctx, draftId, evidenceLevel);
    await ctx.db.patch(draftId, { evidenceLevel, updatedAt: Date.now() });
    if (draft.playbookId) await ctx.db.patch(draft.playbookId, { evidenceLevel });
    return { ok: true };
  },
});

export const feedbackList = query({
  args: { actor: v.string() },
  handler: async (ctx, { actor }) => {
    await requireRole(ctx, actor, "reviewer");
    const all = await ctx.db.query("outcomeFeedback").order("desc").collect();
    return await Promise.all(
      all.map(async (f) => {
        const [pb, buyer] = await Promise.all([ctx.db.get(f.playbookId), ctx.db.get(f.buyerOrgId)]);
        return { ...f, playbookTitle: pb?.publicTitle ?? "(removed)", buyerName: buyer?.displayName ?? "(unknown)" };
      }),
    );
  },
});

export const acknowledgeFeedback = mutation({
  args: { actor: v.string(), feedbackId: v.id("outcomeFeedback") },
  handler: async (ctx, { actor, feedbackId }) => {
    await requireRole(ctx, actor, "reviewer");
    const f = await ctx.db.get(feedbackId);
    if (!f) throw new ConvexError("Feedback not found.");
    await ctx.db.patch(feedbackId, { reviewStatus: "acknowledged" });
  },
});
