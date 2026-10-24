import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireRole } from "./lib/access";
import { recordIntegrationEvent } from "./lib/integrations";
import { audit } from "./lib/audit";
import { toyCaseV } from "./schema";
import type { ToyCase } from "./lib/scenarioTypes";
// Toy apps are plain ESM shared with the local Factory runner; evaluators are protected (never edited by a repair agent).
import { CASES } from "../toy-apps/index.mjs";

type Assertion = { name: string; ok: boolean; detail: string };
type EvalResult = { passed: boolean; summary: string; assertions: Assertion[] };
type ToyCaseDef = { title: string; checkName: string; vulnerable: unknown; fixed: unknown; evaluate: (mod: unknown) => Promise<EvalResult> };
const TOYS = CASES as Record<ToyCase, ToyCaseDef>;

export const VALIDATOR_TOOL = "Local validator (protected evaluator in Convex)";
export const PATCH_TOOL = "Local demo adapter (reference patch)";
export const FACTORY_TOOL = "Factory Droid (droid exec: Read/LS/ApplyPatch only, isolated workspace)";
export const RUNNER_EVAL_TOOL = "Protected evaluator (local runner, Node permission sandbox)";

export function toyTargetName(toyCase: ToyCase) {
  return `Local sample app: ${TOYS[toyCase].title}`;
}

function lines(r: EvalResult): string[] {
  return r.assertions.slice(0, 20).map((a) => `${a.ok ? "PASS" : "FAIL"}  ${a.name}${a.ok ? "" : ` — ${a.detail}`}`.slice(0, 200));
}

/** Run the protected evaluator against one implementation of a toy case. Deterministic, no I/O. */
export async function evaluateToy(toyCase: ToyCase, variant: "vulnerable" | "fixed"): Promise<{ passed: boolean; summary: string; outputLines: string[] }> {
  const def = TOYS[toyCase];
  const r = await def.evaluate(def[variant]);
  return { passed: r.passed, summary: r.summary, outputLines: lines(r) };
}

async function targetFor(ctx: QueryCtx, toyCase: ToyCase): Promise<Doc<"toyTargets">> {
  const t = await ctx.db.query("toyTargets").withIndex("by_slug", (q) => q.eq("slug", toyCase)).unique();
  if (!t) throw new ConvexError("Sample app missing. Reset demo data.");
  if (t.kind !== "local_demo" || !t.authorized) throw new ConvexError("Target is not authorized for validation.");
  return t;
}

async function draftCase(ctx: QueryCtx, draftId: Id<"incidentDrafts">): Promise<{ draft: Doc<"incidentDrafts">; toyCase: ToyCase }> {
  const draft = await ctx.db.get(draftId);
  if (!draft) throw new ConvexError("Draft not found.");
  if (!draft.toyCase) throw new ConvexError("This incident has no sample app to validate against.");
  return { draft, toyCase: draft.toyCase };
}

export const panel = query({
  args: { actor: v.string(), draftId: v.id("incidentDrafts") },
  handler: async (ctx, { actor, draftId }) => {
    await requireRole(ctx, actor, "reviewer");
    const draft = await ctx.db.get(draftId);
    if (!draft) throw new ConvexError("Draft not found.");
    const runs = (await ctx.db.query("validationRuns").withIndex("by_draft", (q) => q.eq("incidentDraftId", draftId)).collect()).sort(
      (a, b) => a.runAt - b.runAt,
    );
    if (!draft.toyCase) return { toyCase: null, target: null, checkName: null, runs };
    const target = await ctx.db.query("toyTargets").withIndex("by_slug", (q) => q.eq("slug", draft.toyCase!)).unique();
    return {
      toyCase: draft.toyCase,
      target: target && {
        name: target.name,
        kind: target.kind,
        authorized: target.authorized,
        authorizationNote: target.authorizationNote,
        variant: target.variant,
      },
      checkName: TOYS[draft.toyCase].checkName,
      runs,
    };
  },
});

export const runCheck = mutation({
  args: { actor: v.string(), draftId: v.id("incidentDrafts"), step: v.union(v.literal("before"), v.literal("after")) },
  handler: async (ctx, { actor, draftId, step }) => {
    const reviewer = await requireRole(ctx, actor, "reviewer");
    const { draft, toyCase } = await draftCase(ctx, draftId);
    const target = await targetFor(ctx, toyCase);
    const result = await evaluateToy(toyCase, target.variant);
    await ctx.db.insert("validationRuns", {
      incidentDraftId: draftId,
      toyCase,
      targetName: target.name,
      authorizationStatus: "Authorized local sample app",
      step,
      toolName: VALIDATOR_TOOL,
      checkName: TOYS[toyCase].checkName,
      passed: result.passed,
      resultSummary: result.summary,
      outputLines: [`implementation: ${target.variant === "fixed" ? "patched" : "original"} sample app`, ...result.outputLines],
      runByOrgId: reviewer._id,
      isDemo: draft.isDemo,
      runAt: Date.now(),
    });
    return result;
  },
});

export const applyFix = mutation({
  args: { actor: v.string(), draftId: v.id("incidentDrafts") },
  handler: async (ctx, { actor, draftId }) => {
    const reviewer = await requireRole(ctx, actor, "reviewer");
    const { draft, toyCase } = await draftCase(ctx, draftId);
    const target = await targetFor(ctx, toyCase);
    await ctx.db.patch(target._id, { variant: "fixed" });
    const patchSummary = `toy-apps/${toyCase}/vulnerable.mjs → toy-apps/${toyCase}/fixed.mjs (reference defensive implementation)`;
    await ctx.db.insert("validationRuns", {
      incidentDraftId: draftId,
      toyCase,
      targetName: target.name,
      authorizationStatus: "Authorized local sample app",
      step: "fix",
      toolName: PATCH_TOOL,
      checkName: TOYS[toyCase].checkName,
      resultSummary: "Applied the reference defensive patch to the sample app.",
      outputLines: [patchSummary],
      patchSummary,
      runByOrgId: reviewer._id,
      isDemo: draft.isDemo,
      runAt: Date.now(),
    });
    await recordIntegrationEvent(ctx, "factory", "fallback", "Patch applied by the local demo adapter.");
  },
});

const runResultV = v.object({ passed: v.boolean(), lines: v.array(v.string()) });

/**
 * Called only by the local Factory runner after: baseline evaluation of the original sample code,
 * a restricted `droid exec` code change in an isolated workspace, and protected re-evaluation of
 * the candidate in a Node permission sandbox. The shared secret proves the call came from the runner.
 */
export const recordFactoryRun = mutation({
  args: {
    actor: v.string(),
    draftId: v.id("incidentDrafts"),
    runnerSecret: v.string(),
    toyCase: toyCaseV,
    baseline: runResultV,
    after: runResultV,
    diff: v.string(),
    changedFiles: v.array(v.string()),
    droidSummary: v.string(),
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const expected = process.env.FACTORY_RUNNER_SECRET;
    if (!expected || args.runnerSecret !== expected) throw new ConvexError("Unrecognized Factory runner.");
    const reviewer = await requireRole(ctx, args.actor, "reviewer");
    const { draft, toyCase } = await draftCase(ctx, args.draftId);
    if (toyCase !== args.toyCase) throw new ConvexError("Sample app does not match this incident.");
    if (args.changedFiles.some((f) => f !== "handler.mjs")) throw new ConvexError("Factory changed files outside the allowlist.");
    const target = await targetFor(ctx, toyCase);
    const base = {
      incidentDraftId: args.draftId,
      toyCase,
      targetName: target.name,
      authorizationStatus: "Authorized local sample app",
      checkName: TOYS[toyCase].checkName,
      runByOrgId: reviewer._id,
      isDemo: draft.isDemo,
    };
    const now = Date.now();
    const clip = (xs: string[]) => xs.slice(0, 20).map((l) => l.slice(0, 200));
    await ctx.db.insert("validationRuns", {
      ...base,
      step: "before",
      toolName: RUNNER_EVAL_TOOL,
      passed: args.baseline.passed,
      resultSummary: args.baseline.passed ? "Original sample code passed (unexpected)." : "Original sample code failed the protected checks.",
      outputLines: clip(args.baseline.lines),
      runAt: now,
    });
    await ctx.db.insert("validationRuns", {
      ...base,
      step: "fix",
      toolName: FACTORY_TOOL,
      resultSummary: `Factory Droid changed ${args.changedFiles.join(", ") || "no files"}. Droid: “${args.droidSummary.slice(0, 200)}”`,
      outputLines: [...args.diff.split("\n").slice(0, 40), `droid session: ${args.sessionId.slice(0, 64)}`],
      patchSummary: args.diff.slice(0, 4000),
      runAt: now + 1,
    });
    await ctx.db.insert("validationRuns", {
      ...base,
      step: "after",
      toolName: RUNNER_EVAL_TOOL,
      passed: args.after.passed,
      resultSummary: args.after.passed
        ? "Factory's candidate passed every protected check, including legitimate behavior."
        : "Factory's candidate failed the protected checks.",
      outputLines: clip(args.after.lines),
      runAt: now + 2,
    });
    await audit(ctx, reviewer, "validation.factory_run", target.name, args.after.passed ? "baseline FAIL → candidate PASS" : "candidate failed");
    await recordIntegrationEvent(
      ctx,
      "factory",
      args.after.passed ? "success" : "failure",
      args.after.passed ? "Factory Droid repaired the sample app; protected checks passed." : "Factory Droid's candidate failed protected checks.",
    );
    return { ok: true };
  },
});

export const recordFactoryFailure = mutation({
  args: { runnerSecret: v.string(), message: v.string() },
  handler: async (ctx, { runnerSecret, message }) => {
    const expected = process.env.FACTORY_RUNNER_SECRET;
    if (!expected || runnerSecret !== expected) throw new ConvexError("Unrecognized Factory runner.");
    await recordIntegrationEvent(ctx, "factory", "failure", message.slice(0, 280));
  },
});

/** Seed-time evidence for catalog guides: actually runs the protected evaluator on both implementations. */
export async function recordSeedValidation(ctx: MutationCtx, playbookId: Id<"playbooks">, toyCase: ToyCase, at: number) {
  const before = await evaluateToy(toyCase, "vulnerable");
  const after = await evaluateToy(toyCase, "fixed");
  const base = {
    playbookId,
    toyCase,
    targetName: toyTargetName(toyCase),
    authorizationStatus: "Authorized local sample app",
    checkName: TOYS[toyCase].checkName,
    isDemo: true,
  };
  const tool = "Local validator (run when demo data was seeded)";
  await ctx.db.insert("validationRuns", { ...base, step: "before", toolName: tool, passed: before.passed, resultSummary: before.summary, outputLines: before.outputLines, runAt: at });
  await ctx.db.insert("validationRuns", {
    ...base,
    step: "fix",
    toolName: PATCH_TOOL,
    resultSummary: "Reference defensive patch applied to the sample app.",
    outputLines: [`toy-apps/${toyCase}/fixed.mjs`],
    patchSummary: `toy-apps/${toyCase}/fixed.mjs`,
    runAt: at + 1,
  });
  await ctx.db.insert("validationRuns", { ...base, step: "after", toolName: tool, passed: after.passed, resultSummary: after.summary, outputLines: after.outputLines, runAt: at + 2 });
}
