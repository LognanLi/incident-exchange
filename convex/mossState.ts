import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { FREE_SECTIONS, SECTION_KEYS, type SectionKey } from "./lib/domain";
import { playbookIndexName } from "./lib/moss";

/** Sections that go into each index scope. Preview never contains locked sections. */
export const indexSource = internalQuery({
  args: { playbookId: v.id("playbooks"), scope: v.union(v.literal("preview"), v.literal("full")) },
  handler: async (ctx, { playbookId, scope }) => {
    const pb = await ctx.db.get(playbookId);
    if (!pb) return null;
    const all: Record<SectionKey, string> = { ...pb.publicSteps, limitations: pb.publicLimitations };
    const keys = scope === "preview" ? FREE_SECTIONS : SECTION_KEYS;
    const sections = Object.fromEntries(keys.map((k) => [k, all[k]])) as Partial<Record<SectionKey, string>>;
    return { name: playbookIndexName(playbookId, scope), sections };
  },
});

export const setStatus = internalMutation({
  args: {
    playbookId: v.id("playbooks"),
    scope: v.union(v.literal("preview"), v.literal("full")),
    name: v.string(),
    status: v.union(v.literal("building"), v.literal("ready"), v.literal("failed")),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { playbookId, scope, name, status, error }) => {
    const pb = await ctx.db.get(playbookId);
    if (!pb) return;
    const existing = await ctx.db
      .query("mossIndexes")
      .withIndex("by_playbook_scope", (q) => q.eq("playbookId", playbookId).eq("scope", scope))
      .unique();
    const doc = { playbookId, scope, name, status, error, isDemo: pb.isDemo, updatedAt: Date.now() };
    if (existing) await ctx.db.patch(existing._id, doc);
    else await ctx.db.insert("mossIndexes", doc);
    if (status !== "building") {
      await ctx.db.insert("integrationEvents", {
        integration: "moss",
        outcome: status === "ready" ? "success" : "failure",
        message: status === "ready" ? `Built Moss index for a playbook (${scope}).` : `Moss index build failed: ${error ?? "unknown"}`,
        at: Date.now(),
      });
    }
  },
});
