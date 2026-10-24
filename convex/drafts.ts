import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireOwnDraft, requireRole } from "./lib/access";
import { EDITABLE_STATUSES, SECTION_KEYS, SYSTEM_CATEGORIES, type SectionKey } from "./lib/domain";
import { draftSectionsFallback } from "./lib/drafting";
import { buyerFacingFields, draftContentHash, identifyingTermsFor, submissionBlockers } from "./lib/draftContent";
import { applyGeneralizations, scanForPrivacyIssues } from "./lib/privacy";
import { sharingLevelV } from "./schema";
import { buildSearchText, publicAliasFor } from "./lib/publish";
import { recordIntegrationEvent } from "./lib/integrations";

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
  identifyingTerms: v.array(v.string()),
  publicTitle: v.string(),
  sanitizedSummary: v.string(),
  systemCategories: v.array(v.string()),
  sharingLevel: sharingLevelV,
  priceMinorUnits: v.number(),
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
  if (!Number.isInteger(f.priceMinorUnits) || f.priceMinorUnits < 500 || f.priceMinorUnits > 50000) {
    throw new ConvexError("Price must be between $5.00 and $500.00.");
  }
  const allowed = new Set<string>(SYSTEM_CATEGORIES);
  if (f.systemCategories.some((c) => !allowed.has(c))) throw new ConvexError("Unknown system category.");
  if (f.identifyingTerms.length > 30) throw new ConvexError("Too many identifying terms.");
}

function assertEditable(draft: Doc<"incidentDrafts">) {
  if (!EDITABLE_STATUSES.includes(draft.status)) {
    throw new ConvexError("This draft is locked while it is in review or published.");
  }
}

/** Any content change invalidates the privacy scan and the contributor's approval. */
const INVALIDATE = { contributorApproval: undefined } as const;

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

    let earnings = 0;
    let sales = 0;
    const perPlaybook = new Map<Id<"playbooks">, { sales: number; earnings: number }>();
    for (const pb of playbooks) {
      const purchases = await ctx.db
        .query("purchases")
        .withIndex("by_playbook", (q) => q.eq("playbookId", pb._id))
        .collect();
      const done = purchases.filter((p) => p.paymentStatus === "simulated_success" || p.paymentStatus === "test_success");
      const e = done.reduce((s, p) => s + p.contributorShareMinorUnits, 0);
      perPlaybook.set(pb._id, { sales: done.length, earnings: e });
      earnings += e;
      sales += done.length;
    }

    return {
      org: { displayName: org.displayName, publicAlias: org.publicAlias },
      earningsMinorUnits: earnings,
      sales,
      currency: "USD",
      drafts: drafts.map((d) => ({
        _id: d._id,
        title: d.title,
        publicTitle: d.publicTitle,
        status: d.status,
        reviewerNote: d.reviewerNote,
        evidenceLevel: d.evidenceLevel,
        playbookId: d.playbookId,
        updatedAt: d.updatedAt,
        stats: d.playbookId ? perPlaybook.get(d.playbookId) ?? { sales: 0, earnings: 0 } : null,
      })),
      catalog: playbooks
        .filter((p) => !p.incidentDraftId)
        .map((p) => ({ _id: p._id, publicTitle: p.publicTitle, stats: perPlaybook.get(p._id) ?? { sales: 0, earnings: 0 } })),
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
      currency: "USD",
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
    await ctx.db.patch(draftId, { ...fields, ...INVALIDATE, updatedAt: Date.now() });
  },
});

/**
 * Structure the contributor's notes into the six-part playbook.
 * The Moss adapter is not wired in this build (see README → Sponsor integrations), so the
 * deterministic fallback runs and the draft is labeled accordingly.
 */
export const generateSections = mutation({
  args: { actor: v.string(), draftId: v.id("incidentDrafts") },
  handler: async (ctx, { actor, draftId }) => {
    const { draft } = await requireOwnDraft(ctx, actor, draftId);
    assertEditable(draft);
    const generated = draftSectionsFallback(draft);
    const sections = Object.fromEntries(
      SECTION_KEYS.map((k) => [k, { body: generated[k].body, accepted: false, origin: "fallback" as const, sourceFields: generated[k].sourceFields }]),
    ) as NonNullable<Doc<"incidentDrafts">["sections"]>;
    await ctx.db.patch(draftId, { sections, draftEngine: "fallback", ...INVALIDATE, updatedAt: Date.now() });
    await recordIntegrationEvent(ctx, "moss", "fallback", "Playbook drafted with the deterministic fallback (Moss not connected).");
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
    await ctx.db.patch(draftId, { sections: { ...draft.sections, [key]: next }, ...INVALIDATE, updatedAt: Date.now() });
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
    await ctx.db.patch(draftId, { sections, ...INVALIDATE, updatedAt: Date.now() });
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
    const next = { ...draft, publicTitle: gen(draft.publicTitle), sanitizedSummary: gen(draft.sanitizedSummary), sections };
    const findings = scanForPrivacyIssues(buyerFacingFields(next), otherTerms, orgTerms);
    await ctx.db.patch(draftId, {
      publicTitle: next.publicTitle,
      sanitizedSummary: next.sanitizedSummary,
      sections,
      privacyFindings: findings,
      privacyScannedHash: draftContentHash(next),
      privacyScannedAt: Date.now(),
      ...INVALIDATE,
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
      contributorApproval: { at: now, contentHash: draftContentHash(draft) },
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
    const doc = {
      incidentDraftId: draftId,
      contributorOrgId: org._id,
      contributorAlias: publicAliasFor(draft.sharingLevel, org),
      publicTitle: draft.publicTitle,
      publicSummary: draft.sanitizedSummary,
      publicSteps: { recognize: body("recognize"), check: body("check"), contain: body("contain"), recover: body("recover"), verify: body("verify") },
      publicLimitations: body("limitations"),
      systemCategories: draft.systemCategories,
      sharingLevel: draft.sharingLevel,
      evidenceLevel: draft.evidenceLevel,
      priceMinorUnits: draft.priceMinorUnits,
      currency: draft.currency,
      publishedAt: Date.now(),
      active: true,
      isDemo: draft.isDemo,
    };
    const searchText = buildSearchText(doc);
    let playbookId = draft.playbookId;
    if (playbookId) await ctx.db.patch(playbookId, { ...doc, searchText });
    else playbookId = await ctx.db.insert("playbooks", { ...doc, searchText });
    await ctx.db.patch(draftId, { status: "published", playbookId, updatedAt: Date.now() });
    return playbookId;
  },
});
