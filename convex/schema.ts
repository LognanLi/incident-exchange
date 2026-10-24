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

/** Traffic Light Protocol 2.0 sharing label (FIRST.org). AMBER guides are sold only to verified organizations. */
export const tlpV = v.union(v.literal("clear"), v.literal("green"), v.literal("amber"));

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

export const toyCaseV = v.union(v.literal("webhook"), v.literal("tenant"), v.literal("keycache"));

const clueV = v.object({ id: v.string(), label: v.string(), terms: v.array(v.string()), weight: v.union(v.literal("key"), v.literal("supporting")) });
const mismatchV = v.object({ id: v.string(), label: v.string(), terms: v.array(v.string()), explanation: v.string() });
export const applicabilityV = v.object({
  clues: v.array(clueV),
  mismatchSignals: v.array(mismatchV),
  checksBeforeUse: v.array(v.string()),
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
    /** Business verification (KYB) — demo flag; a real deployment would verify domain + entity. */
    verified: v.optional(v.boolean()),
    verifiedDomain: v.optional(v.string()),
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
    /** What the contributor tried that did not work (becomes paid guide content after review). */
    failedAttempts: v.string(),
    /** People, products, or customer names the privacy scan must flag. Private. */
    identifyingTerms: v.array(v.string()),
    // ---- Proposed buyer-facing content ----
    publicTitle: v.string(),
    sanitizedSummary: v.string(),
    systemCategories: v.array(v.string()),
    environment: v.array(v.string()),
    sharingLevel: sharingLevelV,
    tlp: v.optional(tlpV),
    /** Integer atomic units of `currency` (USDC: 6 decimals). */
    priceAtomic: v.string(),
    currency: v.string(),
    sections: v.optional(sectionsV),
    applicability: v.optional(applicabilityV),
    evidenceScope: v.string(),
    toyCase: v.optional(toyCaseV),
    /** Increments when shareable content changes after it was approved or submitted. */
    revision: v.number(),
    draftEngine: v.optional(v.union(v.literal("moss"), v.literal("fallback"))),
    // ---- Privacy review ----
    privacyFindings: v.array(privacyFindingV),
    privacyScannedHash: v.optional(v.string()),
    privacyScannedAt: v.optional(v.number()),
    /** Shareable text before the last "apply generalizations", so the contributor can undo it. */
    undoSnapshot: v.optional(
      v.object({ publicTitle: v.string(), sanitizedSummary: v.string(), failedAttempts: v.string(), sections: v.optional(sectionsV) }),
    ),
    contributorApproval: v.optional(v.object({ at: v.number(), contentHash: v.string(), revision: v.number() })),
    // ---- Lifecycle ----
    status: draftStatusV,
    reviewerNote: v.optional(v.string()),
    evidenceLevel: v.optional(evidenceLevelV),
    playbookId: v.optional(v.id("playbooks")),
    /** Agent-submitted (MCP) contributions. */
    agentSubmission: v.optional(
      v.object({
        principalId: v.optional(v.id("agentPrincipals")),
        clientRequestId: v.string(),
        bundleHash: v.string(),
        moderation: v.union(v.literal("clean"), v.literal("quarantined")),
        moderationReasons: v.array(v.string()),
        publicationConsent: v.boolean(),
      }),
    ),
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
    /** Free preview sections only. Paid sections live in playbookRevisions. */
    previewRecognize: v.string(),
    publicLimitations: v.string(),
    systemCategories: v.array(v.string()),
    environment: v.array(v.string()),
    applicability: applicabilityV,
    evidenceScope: v.string(),
    toyCase: v.optional(toyCaseV),
    sharingLevel: sharingLevelV,
    tlp: v.optional(tlpV),
    evidenceLevel: evidenceLevelV,
    priceAtomic: v.string(),
    currency: v.string(),
    revision: v.number(),
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
    incidentDraftId: v.optional(v.id("incidentDrafts")),
    playbookId: v.optional(v.id("playbooks")),
    sourceType: v.optional(v.union(v.literal("provider_docs"), v.literal("security_guidance"), v.literal("advisory_index"))),
    excerpt: v.optional(v.string()),
    checksum: v.optional(v.string()),
    stale: v.optional(v.boolean()),
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
    .index("by_playbook", ["playbookId"])
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
    /** For "request changes": the section the contributor should fix. */
    sectionKey: v.optional(v.string()),
    /** The exact contributor-approved revision this decision applies to. */
    revision: v.number(),
    contentHash: v.string(),
    isDemo: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_draft", ["incidentDraftId"])
    .index("by_isDemo", ["isDemo"]),

  toyTargets: defineTable({
    slug: toyCaseV,
    name: v.string(),
    kind: v.literal("local_demo"),
    authorized: v.boolean(),
    authorizationNote: v.string(),
    /** Which implementation the local validator evaluates. */
    variant: v.union(v.literal("vulnerable"), v.literal("fixed")),
    isDemo: v.boolean(),
  })
    .index("by_slug", ["slug"])
    .index("by_isDemo", ["isDemo"]),

  validationRuns: defineTable({
    incidentDraftId: v.optional(v.id("incidentDrafts")),
    playbookId: v.optional(v.id("playbooks")),
    toyCase: v.optional(toyCaseV),
    targetName: v.string(),
    authorizationStatus: v.string(),
    step: v.union(v.literal("before"), v.literal("fix"), v.literal("after")),
    toolName: v.string(),
    checkName: v.string(),
    passed: v.optional(v.boolean()),
    resultSummary: v.string(),
    outputLines: v.array(v.string()),
    patchSummary: v.optional(v.string()),
    artifactRef: v.optional(v.string()),
    runByOrgId: v.optional(v.id("organizations")),
    isDemo: v.boolean(),
    runAt: v.number(),
  })
    .index("by_draft", ["incidentDraftId"])
    .index("by_playbook", ["playbookId"])
    .index("by_isDemo", ["isDemo"]),

  /** Paid guide content per published revision. Never read by public/preview queries. */
  playbookRevisions: defineTable({
    playbookId: v.id("playbooks"),
    revision: v.number(),
    contentHash: v.string(),
    check: v.string(),
    contain: v.string(),
    recover: v.string(),
    verify: v.string(),
    failedAttempts: v.string(),
    publishedAt: v.number(),
    isDemo: v.boolean(),
  })
    .index("by_playbook_revision", ["playbookId", "revision"])
    .index("by_isDemo", ["isDemo"]),

  /** A buyer's own progress through a guide's verify checklist (never edits the guide). */
  buyerChecklists: defineTable({
    buyerOrgId: v.id("organizations"),
    playbookId: v.id("playbooks"),
    revision: v.number(),
    checked: v.array(v.string()),
    isDemo: v.boolean(),
    updatedAt: v.number(),
  })
    .index("by_buyer_playbook", ["buyerOrgId", "playbookId"])
    .index("by_isDemo", ["isDemo"]),

  purchases: defineTable({
    buyerOrgId: v.id("organizations"),
    playbookId: v.id("playbooks"),
    /** The guide revision this purchase grants. */
    revision: v.number(),
    amountAtomic: v.string(),
    currency: v.string(),
    provider: v.union(v.literal("demo_simulator"), v.literal("x402_test")),
    paymentStatus: v.union(
      v.literal("pending"),
      v.literal("simulated_success"),
      v.literal("test_success"),
      v.literal("cancelled"),
    ),
    /** Internal accrual ledger (exact integer split of amountAtomic). Not an on-chain payout. */
    contributorShareAtomic: v.string(),
    platformShareAtomic: v.string(),
    transactionReference: v.string(),
    /** Data Use License acceptance (internal defensive use, no resale, no re-identification). */
    licenseVersion: v.optional(v.string()),
    /** Agent purchases: the principal, quote, and idempotency key that created them. */
    principalId: v.optional(v.id("agentPrincipals")),
    quoteId: v.optional(v.id("quotes")),
    clientRequestId: v.optional(v.string()),
    licenseAcceptedAt: v.optional(v.number()),
    /** Present for x402 test purchases: what actually settled on Base Sepolia. */
    x402: v.optional(
      v.object({
        network: v.string(),
        asset: v.string(),
        atomicAmount: v.string(),
        payTo: v.string(),
        payer: v.optional(v.string()),
        txHash: v.optional(v.string()),
        error: v.optional(v.string()),
        /** EIP-3009 authorization nonce recorded before settlement, for on-chain reconciliation. */
        nonce: v.optional(v.string()),
        settlingAt: v.optional(v.number()),
      }),
    ),
    isDemo: v.boolean(),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_buyer", ["buyerOrgId"])
    .index("by_buyer_playbook", ["buyerOrgId", "playbookId"])
    .index("by_playbook", ["playbookId"])
    .index("by_principal", ["principalId"])
    .index("by_principal_request", ["principalId", "clientRequestId"])
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

  /** Moss indexes built from published playbook sections (preview = free sections only). */
  mossIndexes: defineTable({
    playbookId: v.id("playbooks"),
    scope: v.union(v.literal("preview"), v.literal("full")),
    name: v.string(),
    status: v.union(v.literal("building"), v.literal("ready"), v.literal("failed")),
    error: v.optional(v.string()),
    isDemo: v.boolean(),
    updatedAt: v.number(),
  })
    .index("by_playbook_scope", ["playbookId", "scope"])
    .index("by_isDemo", ["isDemo"]),

  /** CDP Server Wallet accounts used for x402 test payments (addresses only — keys stay in CDP). */
  x402Wallets: defineTable({
    role: v.union(v.literal("buyer"), v.literal("receiver")),
    accountName: v.string(),
    address: v.string(),
    network: v.string(),
    updatedAt: v.number(),
  }).index("by_role", ["role"]),

  /** Saved symptom searches. New matching guides create alerts in real time. */
  watches: defineTable({
    buyerOrgId: v.id("organizations"),
    query: v.string(),
    createdAt: v.number(),
    isDemo: v.boolean(),
  })
    .index("by_buyer", ["buyerOrgId"])
    .index("by_isDemo", ["isDemo"]),

  alerts: defineTable({
    buyerOrgId: v.id("organizations"),
    watchId: v.id("watches"),
    playbookId: v.id("playbooks"),
    title: v.string(),
    relevance: v.string(),
    matchedClues: v.array(v.string()),
    read: v.boolean(),
    createdAt: v.number(),
    isDemo: v.boolean(),
  })
    .index("by_buyer", ["buyerOrgId", "createdAt"])
    .index("by_isDemo", ["isDemo"]),

  /** Append-only record of security-relevant actions (who did what, when). */
  auditEvents: defineTable({
    orgId: v.optional(v.id("organizations")),
    actorName: v.string(),
    action: v.string(),
    subject: v.string(),
    detail: v.optional(v.string()),
    at: v.number(),
    isDemo: v.boolean(),
  })
    .index("by_at", ["at"])
    .index("by_org", ["orgId", "at"])
    .index("by_isDemo", ["isDemo"]),

  /** Buyer organization spend controls (monthly budget). */
  spendPolicies: defineTable({
    orgId: v.id("organizations"),
    monthlyBudgetAtomic: v.string(),
    isDemo: v.boolean(),
  })
    .index("by_org", ["orgId"])
    .index("by_isDemo", ["isDemo"]),

  /** Agents acting for developers. Tokens are stored only as SHA-256 hashes. Not wiped by demo reset. */
  agentPrincipals: defineTable({
    name: v.string(),
    orgSlug: v.string(),
    scopes: v.array(v.string()),
    tokenHash: v.string(),
    expiresAt: v.number(),
    revoked: v.boolean(),
    /** Spend policy installed by an operator; retrieved content can never change it. */
    policy: v.object({ maxPerPurchaseAtomic: v.string(), sessionMaxAtomic: v.string(), maxPurchases: v.number(), network: v.string(), allowSimulator: v.optional(v.boolean()) }),
    createdAt: v.number(),
  })
    .index("by_tokenHash", ["tokenHash"])
    .index("by_name", ["name"]),

  quotes: defineTable({
    principalId: v.id("agentPrincipals"),
    playbookId: v.id("playbooks"),
    revision: v.number(),
    contentHash: v.string(),
    priceAtomic: v.string(),
    currency: v.string(),
    decimals: v.number(),
    network: v.string(),
    payTo: v.string(),
    expiresAt: v.number(),
    status: v.union(v.literal("open"), v.literal("used")),
    isDemo: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_principal", ["principalId"])
    .index("by_isDemo", ["isDemo"]),

  /** Results from the separate protected test runner (baseline and candidate). */
  repairRuns: defineTable({
    jobId: v.optional(v.id("jobs")),
    principalName: v.string(),
    repo: v.string(),
    stage: v.union(v.literal("baseline"), v.literal("candidate")),
    toolName: v.string(),
    passed: v.boolean(),
    total: v.number(),
    passedCount: v.number(),
    tests: v.array(v.object({ name: v.string(), ok: v.boolean() })),
    diff: v.optional(v.string()),
    changedFiles: v.array(v.string()),
    candidateHash: v.string(),
    protectedSuiteHash: v.string(),
    playbookId: v.optional(v.id("playbooks")),
    revision: v.optional(v.number()),
    mode: v.string(),
    note: v.optional(v.string()),
    at: v.number(),
    isDemo: v.boolean(),
  })
    .index("by_at", ["at"])
    .index("by_isDemo", ["isDemo"]),

  /** OAuth 2.1 access tokens (client_credentials) for the remote MCP endpoint. Only hashes are stored. */
  oauthTokens: defineTable({
    principalId: v.id("agentPrincipals"),
    tokenHash: v.string(),
    audience: v.string(),
    scopes: v.array(v.string()),
    expiresAt: v.number(),
    createdAt: v.number(),
  }).index("by_tokenHash", ["tokenHash"]),

  /** Built web console files served from Convex HTTP actions (scripts/deploy-web.mjs uploads them). */
  webAssets: defineTable({
    path: v.string(),
    storageId: v.id("_storage"),
    contentType: v.string(),
    deployId: v.string(),
  }).index("by_path", ["path"]),

  agentOutcomes: defineTable({
    principalId: v.id("agentPrincipals"),
    playbookId: v.id("playbooks"),
    revision: v.number(),
    reportedPassed: v.boolean(),
    trust: v.union(v.literal("runner_verified"), v.literal("reported_unverified")),
    evidenceRunId: v.optional(v.id("repairRuns")),
    summary: v.string(),
    at: v.number(),
    isDemo: v.boolean(),
  })
    .index("by_playbook", ["playbookId"])
    .index("by_evidenceRun", ["evidenceRunId"])
    .index("by_isDemo", ["isDemo"]),

  /** Minimal, redacted event metadata for the oversight console. */
  agentEvents: defineTable({
    lane: v.union(v.literal("contributor"), v.literal("consumer"), v.literal("security"), v.literal("system")),
    actor: v.string(),
    kind: v.string(),
    summary: v.string(),
    status: v.union(v.literal("ok"), v.literal("pending"), v.literal("denied"), v.literal("error")),
    mode: v.string(),
    refs: v.array(v.string()),
    jobId: v.optional(v.id("jobs")),
    at: v.number(),
    isDemo: v.boolean(),
  })
    .index("by_at", ["at"])
    .index("by_isDemo", ["isDemo"]),

  /** Bounded async work (e.g. the two-agent demo). Generation guards stale callbacks after reset. */
  jobs: defineTable({
    kind: v.string(),
    generation: v.number(),
    status: v.union(v.literal("queued"), v.literal("running"), v.literal("succeeded"), v.literal("failed"), v.literal("canceled")),
    stage: v.optional(v.string()),
    error: v.optional(v.string()),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    isDemo: v.boolean(),
  })
    .index("by_startedAt", ["startedAt"])
    .index("by_isDemo", ["isDemo"]),

  meta: defineTable({ key: v.string(), value: v.number() }).index("by_key", ["key"]),

  integrationEvents: defineTable({
    integration: v.string(),
    outcome: v.union(v.literal("success"), v.literal("failure"), v.literal("fallback")),
    message: v.string(),
    at: v.number(),
  }).index("by_integration", ["integration", "at"]),
});
