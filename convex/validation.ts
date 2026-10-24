import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { requireRole } from "./lib/access";
import { recordIntegrationEvent } from "./lib/integrations";
import { TOY_TARGET } from "./lib/seedData";
import { CHECK_NAME, DEFENSIVE_FIX, describePatch, runThrottlingCheck } from "./lib/toyAuth";

// Truthful attribution: Factory Droid and Armadin are not connected in this build.
export const VALIDATOR_TOOL = "Local validator (toy-auth check)";
export const PATCH_TOOL = "Local demo adapter (deterministic patch)";

async function authorizedTarget(ctx: QueryCtx): Promise<Doc<"toyTargets">> {
  const target = await ctx.db.query("toyTargets").withIndex("by_slug", (q) => q.eq("slug", TOY_TARGET.slug)).unique();
  if (!target) throw new ConvexError("Demo target missing. Reset demo data.");
  // Only the bundled local demo target may ever be validated.
  if (target.kind !== "local_demo" || !target.authorized) throw new ConvexError("Target is not authorized for validation.");
  return target;
}

export const panel = query({
  args: { actor: v.string(), draftId: v.id("incidentDrafts") },
  handler: async (ctx, { actor, draftId }) => {
    await requireRole(ctx, actor, "reviewer");
    const target = await ctx.db.query("toyTargets").withIndex("by_slug", (q) => q.eq("slug", TOY_TARGET.slug)).unique();
    const runs = await ctx.db.query("validationRuns").withIndex("by_draft", (q) => q.eq("incidentDraftId", draftId)).collect();
    return {
      target: target && {
        name: target.name,
        kind: target.kind,
        authorized: target.authorized,
        authorizationNote: target.authorizationNote,
        config: target.config,
        configVersion: target.configVersion,
      },
      checkName: CHECK_NAME,
      runs: runs.sort((a, b) => a.runAt - b.runAt),
    };
  },
});

export const runCheck = mutation({
  args: { actor: v.string(), draftId: v.id("incidentDrafts"), step: v.union(v.literal("before"), v.literal("after")) },
  handler: async (ctx, { actor, draftId, step }) => {
    const reviewer = await requireRole(ctx, actor, "reviewer");
    const draft = await ctx.db.get(draftId);
    if (!draft) throw new ConvexError("Draft not found.");
    const target = await authorizedTarget(ctx);
    const result = runThrottlingCheck(target.config);
    await ctx.db.insert("validationRuns", {
      incidentDraftId: draftId,
      targetName: target.name,
      authorizationStatus: "Authorized local demo target",
      step,
      toolName: VALIDATOR_TOOL,
      checkName: CHECK_NAME,
      passed: result.passed,
      resultSummary: result.summary,
      outputLines: result.outputLines,
      runByOrgId: reviewer._id,
      isDemo: draft.isDemo,
      runAt: Date.now(),
    });
    await recordIntegrationEvent(ctx, "armadin", "fallback", "Validation performed by the local validator (Armadin not connected).");
    return result;
  },
});

export const applyFix = mutation({
  args: { actor: v.string(), draftId: v.id("incidentDrafts") },
  handler: async (ctx, { actor, draftId }) => {
    const reviewer = await requireRole(ctx, actor, "reviewer");
    const draft = await ctx.db.get(draftId);
    if (!draft) throw new ConvexError("Draft not found.");
    const target = await authorizedTarget(ctx);
    const patchSummary = describePatch(target.config, DEFENSIVE_FIX);
    await ctx.db.patch(target._id, { config: DEFENSIVE_FIX, configVersion: target.configVersion + 1 });
    await ctx.db.insert("validationRuns", {
      incidentDraftId: draftId,
      targetName: target.name,
      authorizationStatus: "Authorized local demo target",
      step: "fix",
      toolName: PATCH_TOOL,
      checkName: "Restore failed-attempt lockout and alerting",
      resultSummary: "Applied the defensive configuration to the local demo target.",
      outputLines: patchSummary.split("\n"),
      patchSummary,
      runByOrgId: reviewer._id,
      isDemo: draft.isDemo,
      runAt: Date.now(),
    });
    await recordIntegrationEvent(ctx, "factory", "fallback", "Patch applied by the local demo adapter (Factory Droid not connected).");
  },
});
