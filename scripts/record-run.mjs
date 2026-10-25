// Captures the most recent successful live two-agent run (connector/demo.mjs) from the agent console into
// src/recordings/two-agent-run.json, for remote viewers who can't reach the presenter's runner.
// The recording holds only the redacted console data the live page already shows (events, test results,
// revision hashes and receipts); it excludes local patches/notes and is rescanned before writing. Viewing it executes nothing.
//   node connector/demo.mjs && node scripts/record-run.mjs
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
import { mintSession } from "../shared/session.mjs";
import { scanSecrets } from "../shared/bundle.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const readEnv = (f) => Object.fromEntries(readFileSync(join(ROOT, f), "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
const env = readEnv(".env.local");
const secrets = readEnv(".secrets.local");
const convex = new ConvexHttpClient(env.VITE_CONVEX_URL);
const o = await convex.query(anyApi.agentsConsole.overview, { actor: await mintSession(secrets.DEMO_SESSION_SECRET, "review-desk", 120_000) });

const job = o.jobs.find((j) => j.status === "succeeded" && j.finishedAt);
if (!job) throw new Error("No successful two-agent run to record. Run `node connector/demo.mjs` first.");
const inRun = (at) => at >= job.startedAt && at <= job.finishedAt;
const recording = {
  kind: "recorded_run",
  recordedAt: Date.now(),
  run: { startedAt: job.startedAt, finishedAt: job.finishedAt, durationMs: job.finishedAt - job.startedAt },
  source: { deployment: new URL(env.VITE_CONVEX_URL).hostname.split(".")[0], commit: execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: ROOT }).toString().trim(), ...(execFileSync("git", ["diff", "--name-only"], { cwd: ROOT }).length ? { workingTree: "uncommitted changes" } : {}) },
  overview: {
    events: o.events.filter((e) => inRun(e.at)).map((e) => e.detail && ["factory_repair_finished", "record_outcome"].includes(e.kind) ? { ...e, detail: { ...e.detail, ...(e.kind === "factory_repair_finished" ? { result: "Repair process completed; inspect the separately recorded protected test result." } : {}), input: e.detail.input?.filter((x) => x.k !== "summary") } } : e),
    // The shipped recording is viewable without a purchase: retain verification evidence, never
    // contributor-local notes or a patch that could disclose the paid solution.
    runs: o.runs.filter((r) => inRun(r.at)).map(({ diff: _diff, note: _note, ...r }) => ({ ...r, detailsHidden: true })),
    principals: o.principals,
    submissions: o.submissions,
    outcomes: o.outcomes.filter((x) => inRun(x.at)).map(({ summary: _summary, ...x }) => ({ ...x, summary: "Free-text outcome summary omitted from shareable recording." })),
    jobs: [job],
    purchases: o.purchases,
    applicabilityChecks: (o.applicabilityChecks ?? []).filter((c) => inRun(c.at)).map((c) => ({
      ...c, sourcesHidden: true,
      matched: c.matched.map((x) => ({ ...x, source: "Local fixture evidence (source text omitted from shareable recording)" })),
      conflicts: c.conflicts.map((x) => ({ ...x, source: "Local fixture evidence (source text omitted from shareable recording)" })),
    })),
    // Payments quoted during the run, or earlier purchases this run reused (referenced by its events).
    payments: (o.payments ?? []).filter((p) => inRun(p.quotedAt) || o.events.some((e) => inRun(e.at) && p.purchaseId && e.refs.includes(p.purchaseId))),
    earnings: o.earnings,
  },
};
const text = JSON.stringify(recording, null, 2);
const found = scanSecrets(text);
if (found.length) throw new Error(`Refusing to write the recording: it matched sensitive pattern categories (${found.join(", ")}).`);
mkdirSync(join(ROOT, "src", "recordings"), { recursive: true });
writeFileSync(join(ROOT, "src", "recordings", "two-agent-run.json"), text + "\n");
console.log(`recorded run from ${new Date(job.startedAt).toISOString()} (${Math.round(recording.run.durationMs / 1000)} s, ${recording.overview.events.length} events, ${recording.overview.runs.length} test runs) → src/recordings/two-agent-run.json`);
