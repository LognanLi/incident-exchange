import { ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { seededReferencesFor } from "./lib/apify";
import { publishPlaybook } from "./lib/publish";
import { SEED_ORGS, TOY_AUTHORIZATION_NOTE } from "./lib/seedData";
import { CATALOG, PRIMARY_DRAFT } from "./lib/scenarios";
import { recordSeedValidation, toyTargetName } from "./validation";

function assertDemoEnabled() {
  if (process.env.DEMO_MODE === "off") throw new ConvexError("Demo controls are disabled on this deployment.");
}

export const listOrgs = query({
  args: {},
  handler: async (ctx) => {
    const orgs = await ctx.db.query("organizations").withIndex("by_isDemo", (q) => q.eq("isDemo", true)).collect();
    return orgs.map((o) => ({ slug: o.slug, displayName: o.displayName, demoRole: o.demoRole, description: o.description, isDemo: o.isDemo }));
  },
});

const DAY = 86_400_000;

async function seed(ctx: MutationCtx) {
  const now = Date.now();
  const orgIds = new Map<string, Id<"organizations">>();
  for (const o of SEED_ORGS) orgIds.set(o.slug, await ctx.db.insert("organizations", { ...o, isDemo: true, createdAt: now }));
  // Harbor already watches for its symptoms, so publishing a matching guide triggers a live alert.
  await ctx.db.insert("watches", {
    buyerOrgId: orgIds.get("harbor")!,
    query: "duplicate jobs from the same webhook event id, queue backs up again after restarting workers",
    createdAt: now,
    isDemo: true,
  });
  await ctx.db.insert("auditEvents", { actorName: "System", action: "demo.reset", subject: "Demo data restored", at: now, isDemo: true });
  const orgBySlug = new Map(SEED_ORGS.map((o) => [o.slug, o]));

  for (const toyCase of ["webhook", "tenant", "keycache"] as const) {
    await ctx.db.insert("toyTargets", {
      slug: toyCase,
      name: toyTargetName(toyCase),
      kind: "local_demo",
      authorized: true,
      authorizationNote: TOY_AUTHORIZATION_NOTE,
      variant: "vulnerable",
      isDemo: true,
    });
  }

  // Primary case: a contributor DRAFT so the demo walks the whole lifecycle.
  const p = PRIMARY_DRAFT;
  const draftId = await ctx.db.insert("incidentDrafts", {
    contributorOrgId: orgIds.get("northstar")!,
    title: p.title,
    privateNotes: p.privateNotes,
    evidenceSummary: p.evidenceSummary,
    symptoms: p.symptoms,
    detectionClues: p.detectionClues,
    attemptedActions: p.attemptedActions,
    containmentSteps: p.containmentSteps,
    recoverySteps: p.recoverySteps,
    verificationSteps: p.verificationSteps,
    limitations: p.limitations,
    failedAttempts: p.failedAttempts,
    identifyingTerms: p.identifyingTerms,
    publicTitle: p.publicTitle,
    sanitizedSummary: p.sanitizedSummary,
    systemCategories: p.systemCategories,
    environment: p.environment,
    sharingLevel: "industry_alias",
    priceAtomic: p.price.amountAtomic,
    currency: "USDC",
    applicability: { clues: p.clues, mismatchSignals: p.mismatchSignals, checksBeforeUse: p.checksBeforeUse },
    evidenceScope: p.evidenceScope,
    toyCase: p.toyCase,
    revision: 1,
    privacyFindings: [],
    status: "draft",
    isDemo: true,
    createdAt: now,
    updatedAt: now,
  });
  for (const r of seededReferencesFor("webhook")) {
    await ctx.db.insert("publicReferences", { incidentDraftId: draftId, ...r, retrievedAt: now, seeded: true, retrievedVia: "seeded_fallback", isDemo: true });
  }

  // Published catalog. "Test reproduced" guides get real evaluator runs right here.
  for (const g of CATALOG) {
    const org = orgBySlug.get(g.contributorSlug)!;
    const publishedAt = now - g.publishedDaysAgo * DAY;
    const playbookId = await publishPlaybook(ctx, {
      contributorOrgId: orgIds.get(g.contributorSlug)!,
      contributorAlias: org.publicAlias,
      sharingLevel: "industry_alias",
      tlp: g.family === "tenant_export_authz" && g.evidenceLevel === "test_reproduced" ? "amber" : "green",
      publicTitle: g.publicTitle,
      publicSummary: g.publicSummary,
      systemCategories: g.systemCategories,
      environment: g.environment,
      clues: g.clues,
      mismatchSignals: g.mismatchSignals,
      checksBeforeUse: g.checksBeforeUse,
      evidenceScope: g.evidenceScope,
      evidenceLevel: g.evidenceLevel,
      toyCase: g.toyCase,
      priceAtomic: g.price.amountAtomic,
      revision: 1,
      contentHash: `seed:${g.key}`,
      sections: g.sections,
      failedAttempts: g.failedAttempts,
      publishedAt,
      isDemo: true,
    });
    const family = g.family === "webhook_idempotency" ? "webhook" : g.family === "tenant_export_authz" ? "tenant" : "keycache";
    for (const r of seededReferencesFor(family)) {
      await ctx.db.insert("publicReferences", { playbookId, ...r, retrievedAt: now, seeded: true, retrievedVia: "seeded_fallback", isDemo: true });
    }
    if (g.toyCase && g.evidenceLevel === "test_reproduced") await recordSeedValidation(ctx, playbookId, g.toyCase, now);
  }
}

const DEMO_TABLES = [
  "alerts",
  "watches",
  "auditEvents",
  "spendPolicies",
  "buyerChecklists",
  "playbookRevisions",
  "mossIndexes",
  "outcomeFeedback",
  "purchases",
  "validationRuns",
  "reviews",
  "publicReferences",
  "playbooks",
  "incidentDrafts",
  "toyTargets",
  "organizations",
] as const;

/** Restore the seeded demo. Deletes only records flagged isDemo (plus integration status events). */
export const reset = mutation({
  args: {},
  handler: async (ctx) => {
    assertDemoEnabled();
    const mossNames = (await ctx.db.query("mossIndexes").withIndex("by_isDemo", (q) => q.eq("isDemo", true)).collect()).map((m) => m.name);
    if (mossNames.length) await ctx.scheduler.runAfter(0, internal.mossIndex.deleteIndexes, { names: mossNames });
    for (const table of DEMO_TABLES) {
      const docs = await ctx.db.query(table).withIndex("by_isDemo", (q) => q.eq("isDemo", true)).collect();
      for (const d of docs) await ctx.db.delete(d._id);
    }
    for (const e of await ctx.db.query("integrationEvents").collect()) await ctx.db.delete(e._id);
    await seed(ctx);
    return { ok: true };
  },
});

/** Seed on first load if the deployment is empty. No-op otherwise. */
export const ensureSeeded = mutation({
  args: {},
  handler: async (ctx) => {
    assertDemoEnabled();
    const any = await ctx.db.query("organizations").first();
    if (any) return { seeded: false };
    await seed(ctx);
    return { seeded: true };
  },
});
