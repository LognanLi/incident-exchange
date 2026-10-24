import { ConvexError, v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { requireOwnDraft, requireRole } from "./lib/access";
import { EDITABLE_STATUSES, SECTION_KEYS, SYSTEM_CATEGORIES, type SectionKey } from "./lib/domain";
import { draftSectionsFallback } from "./lib/drafting";
import { buyerFacingFields, draftContentHash, identifyingTermsFor, submissionBlockers } from "./lib/draftContent";
import { applyGeneralizations, scanForPrivacyIssues } from "./lib/privacy";
import { sharingLevelV } from "./schema";
import { publicAliasFor, publishPlaybook } from "./lib/publish";
import { ATOMIC_PER_CENT, sumAtomic } from "./lib/money";
import { recordIntegrationEvent } from "./lib/integrations";
import { MossError, draftWithMoss, mossCredentials } from "./lib/moss";

const sectionKeyV = v.union(
  v.literal("recognize"),
  v.literal("check"),
  v.literal("contain"),
  v.literal("recover"),
  v.literal("verify"),
  v.literal("limitations"),
);

const draftFieldsV = {
  title: v.string(),
  privateNotes: v.string(),
  evidenceSummary: v.string(),
  symptoms: v.string(),
  detectionClues: v.string(),
  attemptedActions: v.string(),
  containmentSteps: v.string(),
  recoverySteps: v.string(),
  verificationSteps: v.string(),
  limitations: v.string(),
  failedAttempts: v.string(),
  identifyingTerms: v.array(v.string()),
  publicTitle: v.string(),
  sanitizedSummary: v.string(),
  systemCategories: v.array(v.string()),
  environment: v.array(v.string()),
  sharingLevel: sharingLevelV,
  priceAtomic: v.string(),
};

type DraftFields = {
  [K in keyof typeof draftFieldsV]: Doc<"incidentDrafts">[K];
};

const MAX_TEXT = 4000;

function validateFields(f: DraftFields) {
  if (!f.title.trim()) throw new ConvexError("Internal title is required.");
  if (!f.symptoms.trim()) throw new ConvexError("Describe at least one symptom.");
  for (const [k, val] of Object.entries(f)) {
    if (typeof val === "string" && val.length > MAX_TEXT) throw new ConvexError(`Field “${k}” is too long.`);
  }
  if (!/^\d+$/.test(f.priceAtomic) || BigInt(f.priceAtomic) % ATOMIC_PER_CENT !== 0n) throw new ConvexError("Price must be whole cents of USDC.");
  if (BigInt(f.priceAtomic) < 100_000n || BigInt(f.priceAtomic) > 1_000_000n) {
    throw new ConvexError("Demo price must be between 0.10 and 1.00 test USDC.");
  }
  if (f.environment.length > 12) throw new ConvexError("Too many environment tags.");
  const allowed = new Set<string>(SYSTEM_CATEGORIES);
  if (f.systemCategories.some((c) => !allowed.has(c))) throw new ConvexError("Unknown system category.");
  if (f.identifyingTerms.length > 30) throw new ConvexError("Too many identifying terms.");
}

function assertEditable(draft: Doc<"incidentDrafts">) {
  if (!EDITABLE_STATUSES.includes(draft.status)) {
    throw new ConvexError("This draft is locked while it is in review or published.");
  }
}

/**
 * Any shareable-content change clears the contributor's approval. If that approval existed (the
 * revision was approved/submitted), the edit starts a new revision that must be approved again.
 */
function invalidate(draft: Doc<"incidentDrafts">) {
  return { contributorApproval: undefined, revision: draft.contributorApproval ? draft.revision + 1 : draft.revision };
}

// ------------------------------------------------------------------ queries

export const listMine = query({
  args: { actor: v.string() },
  handler: async (ctx, { actor }) => {
    const org = await requireRole(ctx, actor, "contributor");
    const drafts = await ctx.db
      .query("incidentDrafts")
      .withIndex("by_contributor", (q) => q.eq("contributorOrgId", org._id))
      .order("desc")
      .collect();
    const playbooks = await ctx.db
      .query("playbooks")
      .withIndex("by_contributor", (q) => q.eq("contributorOrgId", org._id))
      .collect();

    const allShares: string[] = [];
    let sales = 0;
    type Stats = { sales: number; accruedAtomic: string; testnetSales: number; outcomes: { count: number; resolved: number } };
    const perPlaybook = new Map<Id<"playbooks">, Stats>();
    for (const pb of playbooks) {
      const purchases = await ctx.db
        .query("purchases")
        .withIndex("by_playbook", (q) => q.eq("playbookId", pb._id))
        .collect();
      const done = purchases.filter((p) => p.paymentStatus === "simulated_success" || p.paymentStatus === "test_success");
      const feedback = await ctx.db.query("outcomeFeedback").withIndex("by_playbook", (q) => q.eq("playbookId", pb._id)).collect();
      const shares = done.map((p) => p.contributorShareAtomic);
      perPlaybook.set(pb._id, {
        sales: done.length,
        accruedAtomic: sumAtomic(shares),
        testnetSales: done.filter((p) => p.paymentStatus === "test_success").length,
        outcomes: { count: feedback.length, resolved: feedback.filter((f) => f.outcome === "resolved").length },
      });
      allShares.push(...shares);
      sales += done.length;
    }
    const empty: Stats = { sales: 0, accruedAtomic: "0", testnetSales: 0, outcomes: { count: 0, resolved: 0 } };

    return {
      org: { displayName: org.displayName, publicAlias: org.publicAlias },
      accruedAtomic: sumAtomic(allShares),
      /** No payouts are made in this prototype; accruals are an internal ledger. */
      paidOutAtomic: "0",
      sales,
      currency: "USDC",
      drafts: drafts.map((d) => ({
        _id: d._id,
        title: d.title,
        publicTitle: d.publicTitle,
        status: d.status,
        reviewerNote: d.reviewerNote,
        evidenceLevel: d.evidenceLevel,
        playbookId: d.playbookId,
        updatedAt: d.updatedAt,
        revision: d.revision,
        stats: d.playbookId ? perPlaybook.get(d.playbookId) ?? empty : null,
      })),
      catalog: playbooks
        .filter((p) => !p.incidentDraftId)
        .map((p) => ({ _id: p._id, publicTitle: p.publicTitle, stats: perPlaybook.get(p._id) ?? empty })),
    };
  },
});

export const getMine = query({
  args: { actor: v.string(), draftId: v.id("incidentDrafts") },
  handler: async (ctx, { actor, draftId }) => {
    const { draft, org } = await requireOwnDraft(ctx, actor, draftId);
    const reviews = await ctx.db
      .query("reviews")
      .withIndex("by_draft", (q) => q.eq("incidentDraftId", draftId))
      .order("desc")
      .collect();
    const references = await ctx.db
      .query("publicReferences")
      .withIndex("by_draft", (q) => q.eq("incidentDraftId", draftId))
      .collect();
    const currentHash = draftContentHash(draft);
    return {
      draft,
      orgAlias: publicAliasFor(draft.sharingLevel, org),
      reviews: reviews.map((r) => ({ decision: r.decision, note: r.note, evidenceLevel: r.evidenceLevel, createdAt: r.createdAt })),
      references,
      scanIsCurrent: draft.privacyScannedHash === currentHash,
      approvalIsCurrent: draft.contributorApproval?.contentHash === currentHash,
      blockers: submissionBlockers(draft),
    };
  },
});

// ---------------------------------------------------------------- mutations

export const create = mutation({
  args: { actor: v.string(), fields: v.object(draftFieldsV) },
  handler: async (ctx, { actor, fields }) => {
    const org = await requireRole(ctx, actor, "contributor");
    validateFields(fields);
    const now = Date.now();
    return await ctx.db.insert("incidentDrafts", {
      ...fields,
      contributorOrgId: org._id,
      currency: "USDC",
      evidenceScope: "Contributor's account only until a reviewer inspects evidence.",
      revision: 1,
      privacyFindings: [],
      status: "draft",
      isDemo: org.isDemo,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: { actor: v.string(), draftId: v.id("incidentDrafts"), fields: v.object(draftFieldsV) },
  handler: async (ctx, { actor, draftId, fields }) => {
    const { draft } = await requireOwnDraft(ctx, actor, draftId);
    assertEditable(draft);
    validateFields(fields);
    const next = { ...draft, ...fields };
    const changed = draftContentHash(next) !== draftContentHash(draft);
    await ctx.db.patch(draftId, { ...fields, ...(changed ? invalidate(draft) : {}), updatedAt: Date.now() });
    return { ok: true, revision: changed ? invalidate(draft).revision : draft.revision };
  },
});

type Sections = NonNullable<Doc<"incidentDrafts">["sections"]>;

const STANDARD_LIMITATION = draftSectionsFallback({
  symptoms: "", detectionClues: "", attemptedActions: "", containmentSteps: "", recoverySteps: "", verificationSteps: "", limitations: "",
}).limitations.body;

function fallbackSections(draft: Doc<"incidentDrafts">): Sections {
  const generated = draftSectionsFallback(draft);
  return Object.fromEntries(
    SECTION_KEYS.map((k) => [k, { body: generated[k].body, accepted: false, origin: "fallback" as const, sourceFields: generated[k].sourceFields }]),
  ) as Sections;
}

/** Deterministic fallback drafting (always available). */
export const generateSections = mutation({
  args: { actor: v.string(), draftId: v.id("incidentDrafts") },
  handler: async (ctx, { actor, draftId }) => {
    const { draft } = await requireOwnDraft(ctx, actor, draftId);
    assertEditable(draft);
    await ctx.db.patch(draftId, { sections: fallbackSections(draft), draftEngine: "fallback", ...invalidate(draft), updatedAt: Date.now() });
    await recordIntegrationEvent(ctx, "moss", "fallback", "Playbook drafted with the deterministic fallback.");
  },
});

/** Only the structured response fields — never private notes, evidence, or identifying terms. */
export const draftSourceForMoss = internalQuery({
  args: { actor: v.string(), draftId: v.id("incidentDrafts") },
  handler: async (ctx, { actor, draftId }) => {
    const { draft } = await requireOwnDraft(ctx, actor, draftId);
    assertEditable(draft);
    return {
      symptoms: draft.symptoms,
      detectionClues: draft.detectionClues,
      attemptedActions: draft.attemptedActions,
      containmentSteps: draft.containmentSteps,
      recoverySteps: draft.recoverySteps,
      verificationSteps: draft.verificationSteps,
      limitations: draft.limitations,
    };
  },
});

export const saveMossSections = internalMutation({
  args: {
    actor: v.string(),
    draftId: v.id("incidentDrafts"),
    statements: v.object({
      recognize: v.array(v.string()),
      check: v.array(v.string()),
      contain: v.array(v.string()),
      recover: v.array(v.string()),
      verify: v.array(v.string()),
      limitations: v.array(v.string()),
    }),
  },
  handler: async (ctx, { actor, draftId, statements }) => {
    const { draft } = await requireOwnDraft(ctx, actor, draftId);
    assertEditable(draft);
    const sourceFields = Object.fromEntries(SECTION_KEYS.map((k) => [k, draftSectionsFallback(draft)[k].sourceFields]));
    const sections = Object.fromEntries(
      SECTION_KEYS.map((k) => {
        const lines = [...statements[k]];
        if (k === "limitations") lines.push(STANDARD_LIMITATION.replace(/^- /, ""));
        return [k, { body: lines.map((l) => `- ${l.replace(/^\s*[-*•]\s*/, "")}`).join("\n"), accepted: false, origin: "moss" as const, sourceFields: sourceFields[k] }];
      }),
    ) as Sections;
    await ctx.db.patch(draftId, { sections, draftEngine: "moss", ...invalidate(draft), updatedAt: Date.now() });
    await recordIntegrationEvent(ctx, "moss", "success", "Playbook drafted by Moss Inference.");
  },
});

export const recordMossFailure = internalMutation({
  args: { message: v.string() },
  handler: async (ctx, { message }) => {
    await recordIntegrationEvent(ctx, "moss", "failure", message);
  },
});

/**
 * Structure the contributor's notes into the six-part playbook with Moss Inference when configured;
 * otherwise (or on any Moss error) use the deterministic fallback and say so.
 */
export const draftPlaybook = action({
  args: { actor: v.string(), draftId: v.id("incidentDrafts") },
  handler: async (ctx, { actor, draftId }): Promise<{ engine: "moss" | "fallback"; message: string }> => {
    const source = await ctx.runQuery(internal.drafts.draftSourceForMoss, { actor, draftId });
    if (!mossCredentials()) {
      await ctx.runMutation(api.drafts.generateSections, { actor, draftId });
      return { engine: "fallback", message: "Moss is not configured — drafted with the deterministic fallback." };
    }
    try {
      const statements = await draftWithMoss(source);
      await ctx.runMutation(internal.drafts.saveMossSections, { actor, draftId, statements });
      return { engine: "moss", message: "Drafted by Moss. Review each section against your source notes." };
    } catch (err) {
      const reason = err instanceof MossError ? err.message : "unexpected error";
      await ctx.runMutation(internal.drafts.recordMossFailure, { message: `Moss drafting failed (${reason}); used fallback.` });
      await ctx.runMutation(api.drafts.generateSections, { actor, draftId });
      return { engine: "fallback", message: `Moss drafting failed (${reason}) — drafted with the deterministic fallback instead.` };
    }
  },
});

export const updateSection = mutation({
  args: {
    actor: v.string(),
    draftId: v.id("incidentDrafts"),
    key: sectionKeyV,
    body: v.optional(v.string()),
    accepted: v.optional(v.boolean()),
  },
  handler: async (ctx, { actor, draftId, key, body, accepted }) => {
    const { draft } = await requireOwnDraft(ctx, actor, draftId);
    assertEditable(draft);
    if (!draft.sections) throw new ConvexError("Draft the playbook first.");
    if (body !== undefined && body.length > MAX_TEXT) throw new ConvexError("Section is too long.");
    const current = draft.sections[key];
    const bodyChanged = body !== undefined && body !== current.body;
    const next = {
      ...current,
      body: body ?? current.body,
      origin: bodyChanged ? ("manual" as const) : current.origin,
      // Editing text un-accepts the section unless acceptance is set explicitly in the same call.
      accepted: accepted ?? (bodyChanged ? false : current.accepted),
    };
    await ctx.db.patch(draftId, { sections: { ...draft.sections, [key]: next }, ...invalidate(draft), updatedAt: Date.now() });
  },
});

export const acceptAllSections = mutation({
  args: { actor: v.string(), draftId: v.id("incidentDrafts") },
  handler: async (ctx, { actor, draftId }) => {
    const { draft } = await requireOwnDraft(ctx, actor, draftId);
    assertEditable(draft);
    if (!draft.sections) throw new ConvexError("Draft the playbook first.");
    const sections = { ...draft.sections };
    for (const k of SECTION_KEYS) sections[k] = { ...sections[k], accepted: sections[k].body.trim().length > 0 };
    await ctx.db.patch(draftId, { sections, ...invalidate(draft), updatedAt: Date.now() });
  },
});

export const runPrivacyScan = mutation({
  args: { actor: v.string(), draftId: v.id("incidentDrafts") },
  handler: async (ctx, { actor, draftId }) => {
    const { draft, org } = await requireOwnDraft(ctx, actor, draftId);
    assertEditable(draft);
    const { orgTerms, otherTerms } = identifyingTermsFor(draft, org);
    const findings = scanForPrivacyIssues(buyerFacingFields(draft), otherTerms, orgTerms);
    await ctx.db.patch(draftId, {
      privacyFindings: findings,
      privacyScannedHash: draftContentHash(draft),
      privacyScannedAt: Date.now(),
    });
    return { total: findings.length, high: findings.filter((f) => f.severity === "high").length };
  },
});

/** Apply every recommended generalization to buyer-facing text, then re-scan. */
export const applyGeneralizationsToDraft = mutation({
  args: { actor: v.string(), draftId: v.id("incidentDrafts") },
  handler: async (ctx, { actor, draftId }) => {
    const { draft, org } = await requireOwnDraft(ctx, actor, draftId);
    assertEditable(draft);
    const { orgTerms, otherTerms } = identifyingTermsFor(draft, org);
    const gen = (s: string) => applyGeneralizations(s, otherTerms, orgTerms);
    const sections = draft.sections
      ? (Object.fromEntries(
          SECTION_KEYS.map((k) => {
            const s = draft.sections![k];
            const body = gen(s.body);
            return [k, body === s.body ? s : { ...s, body }];
          }),
        ) as NonNullable<Doc<"incidentDrafts">["sections"]>)
      : undefined;
    const next = { ...draft, publicTitle: gen(draft.publicTitle), sanitizedSummary: gen(draft.sanitizedSummary), failedAttempts: gen(draft.failedAttempts), sections };
    const findings = scanForPrivacyIssues(buyerFacingFields(next), otherTerms, orgTerms);
    await ctx.db.patch(draftId, {
      publicTitle: next.publicTitle,
      sanitizedSummary: next.sanitizedSummary,
      failedAttempts: next.failedAttempts,
      sections,
      privacyFindings: findings,
      privacyScannedHash: draftContentHash(next),
      privacyScannedAt: Date.now(),
      ...invalidate(draft),
      updatedAt: Date.now(),
    });
  },
});

/** Explicit contributor approval of the exact buyer-facing version, then submit for human review. */
export const approveAndSubmit = mutation({
  args: { actor: v.string(), draftId: v.id("incidentDrafts"), confirmed: v.boolean() },
  handler: async (ctx, { actor, draftId, confirmed }) => {
    const { draft } = await requireOwnDraft(ctx, actor, draftId);
    assertEditable(draft);
    if (!confirmed) throw new ConvexError("Confirm that you approve the buyer-facing version.");
    const blockers = submissionBlockers(draft);
    if (blockers.length) throw new ConvexError(blockers[0]);
    const now = Date.now();
    await ctx.db.patch(draftId, {
      contributorApproval: { at: now, contentHash: draftContentHash(draft), revision: draft.revision },
      status: "submitted",
      reviewerNote: undefined,
      updatedAt: now,
    });
    return { ok: true };
  },
});

/** After reviewer approval, the contributor gives final approval and the guide becomes searchable. */
export const publishFinal = mutation({
  args: { actor: v.string(), draftId: v.id("incidentDrafts"), confirmed: v.boolean() },
  handler: async (ctx, { actor, draftId, confirmed }) => {
    const { draft, org } = await requireOwnDraft(ctx, actor, draftId);
    if (draft.status !== "approved") throw new ConvexError("Only reviewer-approved drafts can be published.");
    if (!confirmed) throw new ConvexError("Confirm your final approval to publish.");
    if (!draft.sections || !draft.evidenceLevel) throw new ConvexError("Draft is incomplete.");
    if (draft.contributorApproval?.contentHash !== draftContentHash(draft)) {
      throw new ConvexError("Content changed since your approval. Re-approve before publishing.");
    }
    const s = draft.sections;
    const body = (k: SectionKey) => s[k].body;
    const playbookId = await publishPlaybook(ctx, {
      existingPlaybookId: draft.playbookId,
      incidentDraftId: draftId,
      contributorOrgId: org._id,
      contributorAlias: publicAliasFor(draft.sharingLevel, org),
      sharingLevel: draft.sharingLevel,
      publicTitle: draft.publicTitle,
      publicSummary: draft.sanitizedSummary,
      systemCategories: draft.systemCategories,
      environment: draft.environment,
      clues: draft.applicability?.clues ?? [],
      mismatchSignals: draft.applicability?.mismatchSignals ?? [],
      checksBeforeUse: draft.applicability?.checksBeforeUse ?? [],
      evidenceScope: draft.evidenceScope,
      evidenceLevel: draft.evidenceLevel,
      toyCase: draft.toyCase,
      priceAtomic: draft.priceAtomic,
      revision: draft.revision,
      contentHash: draftContentHash(draft),
      sections: { recognize: body("recognize"), check: body("check"), contain: body("contain"), recover: body("recover"), verify: body("verify"), limitations: body("limitations") },
      failedAttempts: draft.failedAttempts,
      publishedAt: Date.now(),
      isDemo: draft.isDemo,
    });
    await ctx.db.patch(draftId, { status: "published", playbookId, updatedAt: Date.now() });
    if (mossCredentials()) await ctx.scheduler.runAfter(0, internal.mossIndex.buildAll, { playbookId });
    return playbookId;
  },
});
