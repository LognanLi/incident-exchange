import { ConvexError, v } from "convex/values";
import { action, internalMutation, internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireDraftAccess } from "./lib/access";
import { fetchWithApify, seededReferencesFor, type SourceFamily } from "./lib/apify";
import { recordIntegrationEvent } from "./lib/integrations";

const CACHE_MS = 24 * 60 * 60 * 1000;

export const list = query({
  args: { actor: v.string(), draftId: v.id("incidentDrafts") },
  handler: async (ctx, { actor, draftId }) => {
    await requireDraftAccess(ctx, actor, draftId);
    return await ctx.db.query("publicReferences").withIndex("by_draft", (q) => q.eq("incidentDraftId", draftId)).collect();
  },
});

/** Only the incident family (a sanitized category) is used to choose sources — never private notes. */
export const authorizeFetch = internalQuery({
  args: { actor: v.string(), draftId: v.id("incidentDrafts") },
  handler: async (ctx, { actor, draftId }) => {
    const { draft } = await requireDraftAccess(ctx, actor, draftId);
    const existing = await ctx.db.query("publicReferences").withIndex("by_draft", (q) => q.eq("incidentDraftId", draftId)).collect();
    const liveAt = existing.filter((r) => r.retrievedVia === "apify" && !r.stale).map((r) => r.retrievedAt);
    return { family: (draft.toyCase ?? "general") as SourceFamily, lastLiveAt: liveAt.length ? Math.max(...liveAt) : null };
  },
});

const refV = v.object({
  title: v.string(),
  url: v.string(),
  sourceName: v.string(),
  relevanceNote: v.string(),
  sourceType: v.union(v.literal("provider_docs"), v.literal("security_guidance"), v.literal("advisory_index")),
  excerpt: v.optional(v.string()),
});

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

export const store = internalMutation({
  args: {
    draftId: v.id("incidentDrafts"),
    via: v.union(v.literal("apify"), v.literal("seeded_fallback")),
    outcome: v.union(v.literal("success"), v.literal("failure"), v.literal("fallback")),
    message: v.string(),
    refs: v.array(refV),
    /** On a failed refresh, keep existing live references (marked stale) instead of replacing them. */
    keepExistingLive: v.optional(v.boolean()),
  },
  handler: async (ctx, { draftId, via, outcome, message, refs, keepExistingLive }) => {
    const draft = await ctx.db.get(draftId);
    if (!draft) throw new ConvexError("Draft not found.");
    const existing = await ctx.db.query("publicReferences").withIndex("by_draft", (q) => q.eq("incidentDraftId", draftId)).collect();
    const live = existing.filter((r) => r.retrievedVia === "apify");
    if (keepExistingLive && live.length) {
      for (const r of live) await ctx.db.patch(r._id, { stale: true });
      await recordIntegrationEvent(ctx, "apify", outcome, `${message} Kept ${live.length} earlier live reference(s), marked stale.`);
      return;
    }
    for (const r of existing) await ctx.db.delete(r._id);
    const now = Date.now();
    for (const r of refs) {
      await ctx.db.insert("publicReferences", {
        incidentDraftId: draftId,
        ...r,
        checksum: r.excerpt ? await sha256(r.excerpt) : undefined,
        retrievedAt: now,
        seeded: via === "seeded_fallback",
        retrievedVia: via,
        stale: false,
        isDemo: draft.isDemo,
      });
    }
    await recordIntegrationEvent(ctx, "apify", outcome, message);
  },
});

/**
 * Retrieve public references through Apify when configured (cached for 24h to avoid repeat charges);
 * otherwise use clearly marked seeded references. A failed refresh never blocks the guide.
 */
export const fetchReferences = action({
  args: { actor: v.string(), draftId: v.id("incidentDrafts"), force: v.optional(v.boolean()) },
  handler: async (ctx, { actor, draftId, force }): Promise<{ via: "apify" | "seeded_fallback" | "cache"; message: string }> => {
    const { family, lastLiveAt } = await ctx.runQuery(internal.references.authorizeFetch, { actor, draftId });
    if (!force && lastLiveAt && Date.now() - lastLiveAt < CACHE_MS) {
      return { via: "cache", message: "Using references retrieved via Apify in the last 24 hours (cached to avoid repeat charges)." };
    }
    const token = process.env.APIFY_TOKEN;
    if (token) {
      try {
        const refs = await fetchWithApify(token, process.env.APIFY_ACTOR_ID || "apify~website-content-crawler", family);
        const message = `Retrieved ${refs.length} allowlisted reference(s) via Apify.`;
        await ctx.runMutation(internal.references.store, { draftId, via: "apify", outcome: "success", message, refs });
        return { via: "apify", message };
      } catch (err) {
        const reason = err instanceof Error ? err.message : "unknown error";
        const message = `Apify request failed (${reason}).`;
        await ctx.runMutation(internal.references.store, {
          draftId,
          via: "seeded_fallback",
          outcome: "failure",
          message,
          refs: seededReferencesFor(family),
          keepExistingLive: true,
        });
        return { via: "seeded_fallback", message: `${message} Showing earlier or seeded references instead.` };
      }
    }
    const message = "APIFY_TOKEN not set; loaded seeded references (not live-retrieved).";
    await ctx.runMutation(internal.references.store, { draftId, via: "seeded_fallback", outcome: "fallback", message, refs: seededReferencesFor(family) });
    return { via: "seeded_fallback", message };
  },
});
