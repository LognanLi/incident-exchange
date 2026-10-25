// Oversight console data: redacted agent events, protected-runner evidence, principals/policies
// (never token hashes or secrets), agent submissions, outcomes, and demo jobs.
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getActor, requireRole, requireOperator } from "./lib/access";

export const overview = query({
  args: { actor: v.string() },
  handler: async (ctx, { actor }) => {
    await getActor(ctx, actor);
    const events = await ctx.db.query("agentEvents").withIndex("by_at").order("desc").take(80);
    const runs = await ctx.db.query("repairRuns").withIndex("by_at").order("desc").take(12);
    const principals = (await ctx.db.query("agentPrincipals").collect()).map((p) => ({
      name: p.name, orgSlug: p.orgSlug, scopes: p.scopes, policy: p.policy, expiresAt: p.expiresAt, revoked: p.revoked,
    }));
    const drafts = (await ctx.db.query("incidentDrafts").collect()).filter((d) => d.agentSubmission);
    const submissions = drafts.map((d) => ({
      _id: d._id, title: d.publicTitle, status: d.status, moderation: d.agentSubmission!.moderation, reasons: d.agentSubmission!.moderationReasons,
      bundleHash: d.agentSubmission!.bundleHash, playbookId: d.playbookId, updatedAt: d.updatedAt,
    }));
    const outcomes = await ctx.db.query("agentOutcomes").order("desc").take(10);
    const jobs = await ctx.db.query("jobs").withIndex("by_startedAt").order("desc").take(5);
    const purchases = (await ctx.db.query("purchases").collect()).filter((p) => p.principalId).map((p) => ({
      _id: p._id, amountAtomic: p.amountAtomic, status: p.paymentStatus, provider: p.provider, contributorShareAtomic: p.contributorShareAtomic, platformShareAtomic: p.platformShareAtomic, txHash: p.x402?.txHash, revision: p.revision,
    }));
    // Latest check_applicability results, newest first. Lists of named conditions with evidence; no scores.
    const applicabilityChecks = (await ctx.db.query("applicabilityChecks").withIndex("by_at").order("desc").take(5)).map((c) => ({
      _id: c._id, principalName: c.principalName, orgSlug: c.orgSlug, playbookId: c.playbookId, revision: c.revision, title: c.title,
      recommendation: c.recommendation, reason: c.reason, matched: c.matched, conflicts: c.conflicts, needsVerification: c.needsVerification, at: c.at,
    }));
    return { events, runs, principals, submissions, outcomes, jobs, purchases, applicabilityChecks };
  },
});

/** Presenter controls may only start the demo as the reviewer/operator identity. */
export const canRunDemo = query({
  args: { actor: v.string() },
  handler: async (ctx, { actor }) => {
    await requireRole(ctx, actor, ["reviewer"]);
    await requireOperator(ctx, actor); // operator control
    const running = (await ctx.db.query("jobs").withIndex("by_startedAt").order("desc").take(1))[0];
    return { ok: !(running && (running.status === "running" || running.status === "queued")) };
  },
});

const RUNNER = () => process.env.FACTORY_RUNNER_SECRET;

export const startJob = mutation({
  args: { runnerSecret: v.string(), kind: v.string() },
  handler: async (ctx, { runnerSecret, kind }) => {
    if (!RUNNER() || runnerSecret !== RUNNER()) throw new ConvexError("Unrecognized runner.");
    const gen = (await ctx.db.query("meta").withIndex("by_key", (q) => q.eq("key", "generation")).unique())?.value ?? 0;
    return { jobId: await ctx.db.insert("jobs", { kind, generation: gen, status: "running", startedAt: Date.now(), isDemo: true }), generation: gen };
  },
});

export const updateJob = mutation({
  args: { runnerSecret: v.string(), jobId: v.id("jobs"), stage: v.optional(v.string()), status: v.optional(v.union(v.literal("running"), v.literal("succeeded"), v.literal("failed"), v.literal("canceled"))), error: v.optional(v.string()) },
  handler: async (ctx, { runnerSecret, jobId, stage, status, error }) => {
    if (!RUNNER() || runnerSecret !== RUNNER()) throw new ConvexError("Unrecognized runner.");
    const job = await ctx.db.get(jobId);
    const gen = (await ctx.db.query("meta").withIndex("by_key", (q) => q.eq("key", "generation")).unique())?.value ?? 0;
    // Stale job (reset happened, or job deleted): ignore rather than resurrect state.
    if (!job || job.generation !== gen || job.status === "canceled") return { ignored: true };
    await ctx.db.patch(jobId, { stage, status: status ?? job.status, error: error?.slice(0, 240), finishedAt: status && status !== "running" ? Date.now() : undefined });
    return { ignored: false };
  },
});

export const cancelJob = mutation({
  args: { actor: v.string(), jobId: v.id("jobs") },
  handler: async (ctx, { actor, jobId }) => {
    await requireRole(ctx, actor, "reviewer");
    const job = await ctx.db.get(jobId);
    if (job && job.status === "running") await ctx.db.patch(jobId, { status: "canceled", finishedAt: Date.now() });
  },
});
