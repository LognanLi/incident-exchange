import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const roleV = v.union(v.literal("contributor"), v.literal("buyer"), v.literal("reviewer"));

export const draftStatusV = v.union(
  v.literal("draft"),
  v.literal("submitted"),
  v.literal("changes_requested"),
  v.literal("rejected"),
  v.literal("approved"),
  v.literal("published"),
);

export const evidenceLevelV = v.union(
  v.literal("contributor_reported"),
  v.literal("evidence_reviewed"),
  v.literal("test_reproduced"),
);

export const sharingLevelV = v.union(v.literal("anonymous"), v.literal("industry_alias"));

export const sectionV = v.object({
  body: v.string(),
  accepted: v.boolean(),
  origin: v.union(v.literal("fallback"), v.literal("moss"), v.literal("manual")),
  /** Which contributor form fields this section was derived from (shown beside the text). */
  sourceFields: v.array(v.string()),
});

export const sectionsV = v.object({
  recognize: sectionV,
  check: sectionV,
  contain: sectionV,
  recover: sectionV,
  verify: sectionV,
  limitations: sectionV,
});

export const privacyFindingV = v.object({
  id: v.string(),
  kind: v.string(),
  label: v.string(),
  severity: v.union(v.literal("high"), v.literal("medium")),
  field: v.string(),
  /** Masked excerpt — the raw match is never stored. */
  excerpt: v.string(),
  suggestion: v.string(),
});

export default defineSchema({
  organizations: defineTable({
    slug: v.string(),
    displayName: v.string(),
    publicAlias: v.string(),
    demoRole: roleV,
    description: v.string(),
    isDemo: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_isDemo", ["isDemo"]),

  incidentDrafts: defineTable({
    contributorOrgId: v.id("organizations"),
    // ---- Private contributor inputs (never returned to buyer-facing queries) ----
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
    /** People, products, or customer names the privacy scan must flag. Private. */
    identifyingTerms: v.array(v.string()),
    // ---- Proposed buyer-facing content ----
    publicTitle: v.string(),
    sanitizedSummary: v.string(),
    systemCategories: v.array(v.string()),
    sharingLevel: sharingLevelV,
    priceMinorUnits: v.number(),
    currency: v.string(),
    sections: v.optional(sectionsV),
    draftEngine: v.optional(v.union(v.literal("moss"), v.literal("fallback"))),
    // ---- Privacy review ----
    privacyFindings: v.array(privacyFindingV),
    privacyScannedHash: v.optional(v.string()),
    privacyScannedAt: v.optional(v.number()),
    contributorApproval: v.optional(v.object({ at: v.number(), contentHash: v.string() })),
    // ---- Lifecycle ----
    status: draftStatusV,
    reviewerNote: v.optional(v.string()),
    evidenceLevel: v.optional(evidenceLevelV),
    playbookId: v.optional(v.id("playbooks")),
    isDemo: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_contributor", ["contributorOrgId"])
    .index("by_status", ["status"])
    .index("by_isDemo", ["isDemo"]),

  playbooks: defineTable({
    incidentDraftId: v.optional(v.id("incidentDrafts")),
    contributorOrgId: v.id("organizations"),
    contributorAlias: v.string(),
    publicTitle: v.string(),
    publicSummary: v.string(),
    publicSteps: v.object({
      recognize: v.string(),
      check: v.string(),
      contain: v.string(),
      recover: v.string(),
      verify: v.string(),
    }),
    publicLimitations: v.string(),
    systemCategories: v.array(v.string()),
    sharingLevel: sharingLevelV,
    evidenceLevel: evidenceLevelV,
    priceMinorUnits: v.number(),
    currency: v.string(),
    publishedAt: v.number(),
    active: v.boolean(),
    searchText: v.string(),
    isDemo: v.boolean(),
  })
    .index("by_active", ["active"])
    .index("by_draft", ["incidentDraftId"])
    .index("by_contributor", ["contributorOrgId"])
    .index("by_isDemo", ["isDemo"])
    .searchIndex("search_text", { searchField: "searchText", filterFields: ["active"] }),

  publicReferences: defineTable({
    incidentDraftId: v.id("incidentDrafts"),
    title: v.string(),
    sourceName: v.string(),
    url: v.string(),
    publishedAt: v.optional(v.string()),
    retrievedAt: v.number(),
    relevanceNote: v.string(),
    /** true = curated fallback reference, not live-retrieved through Apify. */
    seeded: v.boolean(),
    retrievedVia: v.union(v.literal("apify"), v.literal("seeded_fallback")),
    isDemo: v.boolean(),
  })
    .index("by_draft", ["incidentDraftId"])
    .index("by_isDemo", ["isDemo"]),

  reviews: defineTable({
    incidentDraftId: v.id("incidentDrafts"),
    reviewerOrgId: v.id("organizations"),
    checklist: v.object({
      sixSectionsComplete: v.boolean(),
      noSensitiveData: v.boolean(),
      defensiveOnly: v.boolean(),
      evidenceSupportsLabel: v.boolean(),
      limitationsStated: v.boolean(),
    }),
    decision: v.union(v.literal("approve"), v.literal("request_changes"), v.literal("reject")),
    evidenceLevel: v.optional(evidenceLevelV),
    note: v.string(),
    isDemo: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_draft", ["incidentDraftId"])
    .index("by_isDemo", ["isDemo"]),

  toyTargets: defineTable({
    slug: v.string(),
    name: v.string(),
    kind: v.literal("local_demo"),
    authorized: v.boolean(),
    authorizationNote: v.string(),
    config: v.object({
      maxFailedAttempts: v.number(),
      lockoutWindowSeconds: v.number(),
      alertOnRepeatedFailures: v.boolean(),
    }),
    configVersion: v.number(),
    isDemo: v.boolean(),
  })
    .index("by_slug", ["slug"])
    .index("by_isDemo", ["isDemo"]),

  validationRuns: defineTable({
    incidentDraftId: v.id("incidentDrafts"),
    targetName: v.string(),
    authorizationStatus: v.string(),
    step: v.union(v.literal("before"), v.literal("fix"), v.literal("after")),
    toolName: v.string(),
    checkName: v.string(),
    passed: v.optional(v.boolean()),
    resultSummary: v.string(),
    outputLines: v.array(v.string()),
    patchSummary: v.optional(v.string()),
    runByOrgId: v.id("organizations"),
    isDemo: v.boolean(),
    runAt: v.number(),
  })
    .index("by_draft", ["incidentDraftId"])
    .index("by_isDemo", ["isDemo"]),

  purchases: defineTable({
    buyerOrgId: v.id("organizations"),
    playbookId: v.id("playbooks"),
    amountMinorUnits: v.number(),
    currency: v.string(),
    provider: v.union(v.literal("demo_simulator"), v.literal("x402_test")),
    paymentStatus: v.union(
      v.literal("pending"),
      v.literal("simulated_success"),
      v.literal("test_success"),
      v.literal("cancelled"),
    ),
    contributorShareMinorUnits: v.number(),
    platformShareMinorUnits: v.number(),
    transactionReference: v.string(),
    isDemo: v.boolean(),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_buyer", ["buyerOrgId"])
    .index("by_buyer_playbook", ["buyerOrgId", "playbookId"])
    .index("by_playbook", ["playbookId"])
    .index("by_isDemo", ["isDemo"]),

  outcomeFeedback: defineTable({
    buyerOrgId: v.id("organizations"),
    playbookId: v.id("playbooks"),
    relevance: v.union(v.literal("very_relevant"), v.literal("somewhat_relevant"), v.literal("not_relevant")),
    outcome: v.union(
      v.literal("resolved"),
      v.literal("partially_resolved"),
      v.literal("not_resolved"),
      v.literal("not_tried_yet"),
    ),
    notes: v.string(),
    reviewStatus: v.union(v.literal("new"), v.literal("acknowledged")),
    isDemo: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_playbook", ["playbookId"])
    .index("by_isDemo", ["isDemo"]),

  integrationEvents: defineTable({
    integration: v.string(),
    outcome: v.union(v.literal("success"), v.literal("failure"), v.literal("fallback")),
    message: v.string(),
    at: v.number(),
  }).index("by_integration", ["integration", "at"]),
});
