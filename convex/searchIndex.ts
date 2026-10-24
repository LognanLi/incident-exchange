import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { publicPreviewDoc } from "./lib/searchIndex";

/** Documents for the shared public-preview index: active guides, free fields only. */
export const publicIndexSource = internalQuery({
  args: {},
  handler: async (ctx) => {
    const active = await ctx.db.query("playbooks").withIndex("by_active", (q) => q.eq("active", true)).collect();
    return active.map(publicPreviewDoc);
  },
});

export const recordEvent = internalMutation({
  args: { outcome: v.union(v.literal("success"), v.literal("failure")), message: v.string() },
  handler: async (ctx, { outcome, message }) => {
    await ctx.db.insert("integrationEvents", { integration: "moss", outcome, message: message.slice(0, 300), at: Date.now() });
  },
});
