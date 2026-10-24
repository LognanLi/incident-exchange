import { ConvexError, v } from "convex/values";
import { action, internalMutation, internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireDraftAccess } from "./lib/access";
import { fetchWithApify, seededReferencesFor } from "./lib/apify";
import { recordIntegrationEvent } from "./lib/integrations";

export const list = query({
  args: { actor: v.string(), draftId: v.id("incidentDrafts") },
  handler: async (ctx, { actor, draftId }) => {
    await requireDraftAccess(ctx, actor, draftId);
    return await ctx.db.query("publicReferences").withIndex("by_draft", (q) => q.eq("incidentDraftId", draftId)).collect();
  },
});

export const authorizeFetch = internalQuery({
  args: { actor: v.string(), draftId: v.id("incidentDrafts") },
  handler: async (ctx, { actor, draftId }) => {
    const { draft } = await requireDraftAccess(ctx, actor, draftId);
    return { categories: draft.systemCategories };
  },
});

export const store = internalMutation({
  args: {
    draftId: v.id("incidentDrafts"),
    via: v.union(v.literal("apify"), v.literal("seeded_fallback")),
    outcome: v.union(v.literal("success"), v.literal("failure"), v.literal("fallback")),
    message: v.string(),
    refs: v.array(v.object({ title: v.string(), url: v.string(), sourceName: v.string(), relevanceNote: v.string() })),
  },
  handler: async (ctx, { draftId, via, outcome, message, refs }) => {
    const draft = await ctx.db.get(draftId);
    if (!draft) throw new ConvexError("Draft not found.");
    const existing = await ctx.db.query("publicReferences").withIndex("by_draft", (q) => q.eq("incidentDraftId", draftId)).collect();
    for (const r of existing) await ctx.db.delete(r._id);
    const now = Date.now();
    for (const r of refs) {
      await ctx.db.insert("publicReferences", {
        incidentDraftId: draftId,
        ...r,
        retrievedAt: now,
        seeded: via === "seeded_fallback",
        retrievedVia: via,
        isDemo: draft.isDemo,
      });
    }
    await recordIntegrationEvent(ctx, "apify", outcome, message);
  },
});

/** Retrieve public references through Apify when configured; otherwise use clearly marked seeded references. */
export const fetchReferences = action({
  args: { actor: v.string(), draftId: v.id("incidentDrafts") },
  handler: async (ctx, { actor, draftId }): Promise<{ via: "apify" | "seeded_fallback"; message: string }> => {
    const { categories } = await ctx.runQuery(internal.references.authorizeFetch, { actor, draftId });
    const token = process.env.APIFY_TOKEN;
    if (token) {
      try {
        const refs = await fetchWithApify(token, process.env.APIFY_ACTOR_ID || "apify~website-content-crawler", categories);
        const message = `Retrieved ${refs.length} allowlisted reference(s) via Apify.`;
        await ctx.runMutation(internal.references.store, { draftId, via: "apify", outcome: "success", message, refs });
        return { via: "apify", message };
      } catch (err) {
        const reason = err instanceof Error ? err.message : "unknown error";
        const message = `Apify request failed (${reason}); using seeded references instead.`;
        await ctx.runMutation(internal.references.store, { draftId, via: "seeded_fallback", outcome: "failure", message, refs: seededReferencesFor(categories) });
        return { via: "seeded_fallback", message };
      }
    }
    const message = "APIFY_TOKEN not set; loaded seeded references (not live-retrieved).";
    await ctx.runMutation(internal.references.store, { draftId, via: "seeded_fallback", outcome: "fallback", message, refs: seededReferencesFor(categories) });
    return { via: "seeded_fallback", message };
  },
});
