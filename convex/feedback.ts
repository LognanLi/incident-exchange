import { ConvexError, v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireRole } from "./lib/access";

export const submit = mutation({
  args: {
    actor: v.string(),
    playbookId: v.id("playbooks"),
    relevance: v.union(v.literal("very_relevant"), v.literal("somewhat_relevant"), v.literal("not_relevant")),
    outcome: v.union(v.literal("resolved"), v.literal("partially_resolved"), v.literal("not_resolved"), v.literal("not_tried_yet")),
    notes: v.string(),
  },
  handler: async (ctx, { actor, playbookId, relevance, outcome, notes }) => {
    const buyer = await requireRole(ctx, actor, "buyer");
    const pb = await ctx.db.get(playbookId);
    if (!pb || !pb.active) throw new ConvexError("Playbook not found.");
    if (notes.length > 2000) throw new ConvexError("Notes are too long.");
    return await ctx.db.insert("outcomeFeedback", {
      buyerOrgId: buyer._id,
      playbookId,
      relevance,
      outcome,
      notes: notes.trim(),
      reviewStatus: "new",
      isDemo: buyer.isDemo,
      createdAt: Date.now(),
    });
  },
});
