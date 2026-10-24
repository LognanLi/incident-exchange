import { ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { seededReferencesFor } from "./lib/apify";
import { buildSearchText } from "./lib/publish";
import { CATALOG_PLAYBOOKS, NORTHSTAR_DRAFT, SEED_ORGS, TOY_TARGET } from "./lib/seedData";
import { MISCONFIGURED } from "./lib/toyAuth";

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

async function seed(ctx: MutationCtx) {
  const now = Date.now();
  const orgIds = new Map<string, Id<"organizations">>();
  for (const o of SEED_ORGS) {
    orgIds.set(o.slug, await ctx.db.insert("organizations", { ...o, isDemo: true, createdAt: now }));
  }

  const northstarDraftId = await ctx.db.insert("incidentDrafts", {
    ...NORTHSTAR_DRAFT,
    contributorOrgId: orgIds.get("northstar")!,
    privacyFindings: [],
    status: "draft",
    isDemo: true,
    createdAt: now,
    updatedAt: now,
  });
  for (const r of seededReferencesFor(NORTHSTAR_DRAFT.systemCategories)) {
    await ctx.db.insert("publicReferences", {
      incidentDraftId: northstarDraftId,
      ...r,
      retrievedAt: now,
      seeded: true,
      retrievedVia: "seeded_fallback",
      isDemo: true,
    });
  }

  const cobalt = SEED_ORGS.find((o) => o.slug === "cobalt")!;
  for (const [i, pb] of CATALOG_PLAYBOOKS.entries()) {
    const { contributorSlug, ...rest } = pb;
    await ctx.db.insert("playbooks", {
      ...rest,
      contributorOrgId: orgIds.get(contributorSlug)!,
      contributorAlias: cobalt.publicAlias,
      sharingLevel: "industry_alias",
      currency: "USD",
      publishedAt: now - (i + 1) * 86_400_000 * 7,
      active: true,
      searchText: buildSearchText(rest),
      isDemo: true,
    });
  }

  await ctx.db.insert("toyTargets", {
    ...TOY_TARGET,
    kind: "local_demo",
    authorized: true,
    config: MISCONFIGURED,
    configVersion: 1,
    isDemo: true,
  });
}

const DEMO_TABLES = [
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
