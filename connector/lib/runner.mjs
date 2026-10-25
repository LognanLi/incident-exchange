// Separate protected test runner + evidence recording. The runner has only the runner secret: it can
// append repair runs/events, but cannot read earnings or contributor identities.
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
import { runProtectedTests } from "../../sample-repos/run-protected-tests.mjs";
import { ROOT, readEnv } from "./mcpClient.mjs";
import { sanitizeEventDetail } from "../../shared/eventDetail.mjs";

const secrets = readEnv(join(ROOT, ".secrets.local"));
const local = readEnv(join(ROOT, ".env.local"));
const convex = new ConvexHttpClient(process.env.VITE_CONVEX_URL ?? local.VITE_CONVEX_URL);
const RUNNER_SECRET = secrets.FACTORY_RUNNER_SECRET;

export const generation = () => convex.query(anyApi.mcp.generation, {});

function hashDir(dir) {
  const h = createHash("sha256");
  for (const f of readdirSync(dir, { recursive: true }).map(String).sort()) {
    try {
      h.update(f).update(readFileSync(join(dir, f)));
    } catch {
      /* directories */
    }
  }
  return "sha256:" + h.digest("hex").slice(0, 32);
}

export async function protectedRun({ repo, candidateDir, stage, principalName, resolutionId, diff, changedFiles = [], note, mode = "local", gen }) {
  const r = await runProtectedTests({ repo, candidateDir });
  const suite = join(ROOT, "sample-repos", repo, "protected-tests");
  const rec = await convex.mutation(anyApi.mcp.recordRepairRun, {
    runnerSecret: RUNNER_SECRET, generation: gen, principalName, repo, stage, toolName: "Protected test runner (node --test, separate process)",
    passed: r.passed, total: r.total, passedCount: r.passedCount, tests: r.tests.slice(0, 20), diff, changedFiles,
    candidateHash: hashDir(candidateDir), protectedSuiteHash: hashDir(suite), resolutionId, mode, note,
  });
  if (rec.__denied) throw new Error(`${rec.__denied.code}: ${rec.__denied.message}`);
  return { ...r, runId: rec.runId };
}

/** extra: { detail?: { tool, input, result, resolutionId, revision, evidence }, refs?: string[] }. Sanitized here and again server-side. */
export async function logEvent(lane, actor, kind, summary, status = "ok", mode = "local", gen, extra = {}) {
  const detail = sanitizeEventDetail(extra.detail);
  await convex.mutation(anyApi.mcp.logConnectorEvent, { runnerSecret: RUNNER_SECRET, generation: gen, lane, actor, kind, summary, status, mode, ...(detail ? { detail } : {}), ...(extra.refs?.length ? { refs: extra.refs } : {}) });
}
