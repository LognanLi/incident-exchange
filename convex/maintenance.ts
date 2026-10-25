// One-off data maintenance for the shared cloud deployment. Internal only (run with `npx convex run`).
// Every function defaults to a dry run that lists its effects; pass `apply: true` to write.
import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { audit } from "./lib/audit";
import { validateConditions } from "../shared/applicability.mjs";

const WEBHOOK_TITLE = "Duplicate jobs when a webhook provider retries the same event";

/**
 * Approved by the project owner on 2026-10-24: keep the newest published webhook guide (the one rehearsals
 * reuse), deactivate (never delete) the two older duplicates, which keep their purchases, outcomes and
 * feedback, and delete five quarantined "(quick fix)" drafts left by old attack-check runs.
 * Records are named by ID suffix; each suffix must match exactly one record that passes its guard.
 */
export const dedupeWebhookGuides = internalMutation({
  args: {
    apply: v.optional(v.boolean()),
    keep: v.string(),
    deactivate: v.array(v.string()),
    deleteDrafts: v.array(v.string()),
  },
  handler: async (ctx, a) => {
    const playbooks = await ctx.db.query("playbooks").collect();
    const drafts = await ctx.db.query("incidentDrafts").collect();
    const one = <T extends { _id: string }>(rows: T[], suffix: string, what: string): T => {
      const hits = rows.filter((r) => r._id.endsWith(suffix));
      if (hits.length !== 1) throw new Error(`${what} suffix ${suffix} matched ${hits.length} records`);
      return hits[0];
    };

    const keep = one(playbooks, a.keep, "keep");
    if (!keep.active || keep.publicTitle !== WEBHOOK_TITLE) throw new Error(`keep ${keep._id} is not an active "${WEBHOOK_TITLE}" guide`);
    const toDeactivate = a.deactivate.map((s) => one(playbooks, s, "deactivate"));
    for (const pb of toDeactivate) {
      if (pb._id === keep._id) throw new Error("cannot deactivate the guide being kept");
      if (pb.publicTitle !== WEBHOOK_TITLE) throw new Error(`${pb._id} is not a "${WEBHOOK_TITLE}" guide`);
    }
    const toDelete = a.deleteDrafts.map((s) => one(drafts, s, "deleteDrafts"));
    for (const d of toDelete) {
      if (d.agentSubmission?.moderation !== "quarantined") throw new Error(`draft ${d._id} is not quarantined`);
      if (d.playbookId || playbooks.some((pb) => pb.incidentDraftId === d._id)) throw new Error(`draft ${d._id} has a published guide`);
    }

    // Records that point at a deleted draft go with it.
    const dependents: { table: "publicReferences" | "reviews" | "validationRuns"; id: Id<"publicReferences"> | Id<"reviews"> | Id<"validationRuns">; draft: string }[] = [];
    for (const d of toDelete) {
      for (const r of await ctx.db.query("publicReferences").collect()) if (r.incidentDraftId === d._id) dependents.push({ table: "publicReferences", id: r._id, draft: d._id });
      for (const r of await ctx.db.query("reviews").collect()) if (r.incidentDraftId === d._id) dependents.push({ table: "reviews", id: r._id, draft: d._id });
      for (const r of await ctx.db.query("validationRuns").collect()) if (r.incidentDraftId === d._id) dependents.push({ table: "validationRuns", id: r._id, draft: d._id });
    }
    const counts = async (pb: Doc<"playbooks">) => ({
      purchases: (await ctx.db.query("purchases").collect()).filter((p) => p.playbookId === pb._id).length,
      outcomeFeedback: (await ctx.db.query("outcomeFeedback").collect()).filter((f) => f.playbookId === pb._id).length,
    });

    const plan = {
      apply: !!a.apply,
      keep: { id: keep._id, publishedAt: new Date(keep.publishedAt).toISOString(), ...(await counts(keep)) },
      deactivate: await Promise.all(
        toDeactivate.map(async (pb) => ({ id: pb._id, active: pb.active, publishedAt: new Date(pb.publishedAt).toISOString(), keeps: await counts(pb) })),
      ),
      deleteDrafts: toDelete.map((d) => ({ id: d._id, title: d.title, status: d.status, moderation: d.agentSubmission?.moderation })),
      deleteDependents: dependents,
      activeWebhookGuidesAfter: playbooks.filter((pb) => pb.active && pb.publicTitle === WEBHOOK_TITLE && !toDeactivate.some((x) => x._id === pb._id)).map((pb) => pb._id),
    };
    if (!a.apply) return plan;

    for (const pb of toDeactivate) if (pb.active) await ctx.db.patch(pb._id, { active: false });
    for (const dep of dependents) await ctx.db.delete(dep.id);
    for (const d of toDelete) await ctx.db.delete(d._id);
    await audit(ctx, null, "maintenance.dedupe", WEBHOOK_TITLE, `kept 1, deactivated ${toDeactivate.length}, deleted ${toDelete.length} quarantined drafts`);
    // Search only returns active guides; the shared index catches up too.
    await ctx.scheduler.runAfter(0, internal.semanticSearch.rebuildPublicIndex, {});
    return plan;
  },
});

/**
 * Reviewer curation: attach structured applicability conditions to a published guide that predates them,
 * translated from the guide's own stated applicability and limitations. Public preview metadata only:
 * the paid revision, its hash, and existing entitlements are unchanged. Dry run unless `apply`.
 */
export const setGuideConditions = internalMutation({
  args: {
    apply: v.optional(v.boolean()),
    playbook: v.string(),
    conditions: v.array(v.object({ fact: v.string(), expected: v.boolean(), note: v.optional(v.string()) })),
  },
  handler: async (ctx, a) => {
    const hits = (await ctx.db.query("playbooks").collect()).filter((pb) => pb._id.endsWith(a.playbook) && pb.active);
    if (hits.length !== 1) throw new Error(`playbook suffix ${a.playbook} matched ${hits.length} active guides`);
    const pb = hits[0];
    const conditions = validateConditions(a.conditions);
    const plan = { apply: !!a.apply, id: pb._id, title: pb.publicTitle, revision: pb.revision, before: pb.applicability.conditions ?? null, after: conditions, sourceText: pb.applicability.checksBeforeUse };
    if (!a.apply) return plan;
    await ctx.db.patch(pb._id, { applicability: { ...pb.applicability, conditions } });
    await audit(ctx, null, "guide.conditions_set", pb.publicTitle, `${conditions.length} structured conditions from the guide's stated applicability and limitations (revision ${pb.revision} unchanged)`);
    return plan;
  },
});
