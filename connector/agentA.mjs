// Agent A (contributor): fail → fix → independently verify → stage sanitized bundle → approve exact hash → submit via MCP.
//   node connector/agentA.mjs                 # runs, stages, prints preview + hash, stops (needs approval)
//   node connector/agentA.mjs --approve <hash> # developer approves that exact bundle → submit
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, ROOT, policy } from "./lib/mcpClient.mjs";
import { enforceCandidate, snapshot, stageField } from "./lib/policy.mjs";
import { protectedRun, logEvent, generation } from "./lib/runner.mjs";
import { lineDiff } from "./lib/diff.mjs";
import { bundleHash, SCHEMA_VERSION } from "../shared/bundle.mjs";

const args = process.argv.slice(2);
const approveHash = args.includes("--approve") ? args[args.indexOf("--approve") + 1] : null;
const P = policy();
const STAGED = join(ROOT, "connector", ".staging", "agent-a-bundle.json");

// Approval path: submit exactly the staged bundle the developer reviewed (no re-run, no re-generation).
if (approveHash) {
  const staged = JSON.parse(readFileSync(STAGED, "utf8"));
  if (staged.contentHash !== approveHash || (await bundleHash(staged)) !== approveHash) {
    console.log("[agent-a] approval hash does not match the staged bundle — re-stage and review again");
    process.exit(3);
  }
  staged.approval = { kind: "developer_approval", reference: `dev-approval-${Date.now()}`, contentHash: approveHash };
  const c = await connect("AGENT_A_TOKEN");
  const r = await c.tool("submit_resolution", { bundle: staged });
  console.log(`[agent-a] submit_resolution → ${r.text}`);
  await c.close();
  if (r.isError) process.exit(4);
  writeFileSync(join(ROOT, "connector", ".staging", "agent-a-submission.json"), JSON.stringify(r.envelope.data, null, 2));
  process.exit(0);
}
const repo = P.repos["repo-a"];
const gen = await generation();
const say = (s) => console.log(`[agent-a] ${s}`);

// 1–2. Isolated candidate workspace; baseline must fail.
const ws = mkdtempSync(join(tmpdir(), "ix-agent-a-"));
cpSync(join(ROOT, repo.root, "src"), join(ws, "src"), { recursive: true });
const before = snapshot(ws);
const base = await protectedRun({ repo: "repo-a", candidateDir: join(ws, "src"), stage: "baseline", principalName: "agent-a", gen, note: "original code" });
say(`baseline: ${base.passedCount}/${base.total} protected tests passed (expected to fail)`);

// 3. Fix (Agent A's own fix: reference patch applied by the local connector — labeled, not attributed to Factory).
cpSync(join(ROOT, repo.root, "reference-fix", "handler.mjs"), join(ws, "src", "handler.mjs"));
const changed = enforceCandidate({ workspace: ws, before, editable: repo.editable });
const diff = lineDiff(before.get("src/handler.mjs"), readFileSync(join(ws, "src", "handler.mjs"), "utf8"), "src/handler.mjs");
const cand = await protectedRun({ repo: "repo-a", candidateDir: join(ws, "src"), stage: "candidate", principalName: "agent-a", diff, changedFiles: changed, gen, note: "Agent A fix (reference patch, local connector)" });
say(`candidate: ${cand.passedCount}/${cand.total} protected tests passed`);
rmSync(ws, { recursive: true, force: true });
if (!cand.passed) {
  say("fix failed protected tests; nothing will be shared");
  process.exit(1);
}

// 4. Local disclosure gate: minimal allowed fields only, before any network call.
const raw = JSON.parse(readFileSync(join(ROOT, "connector", "fixtures", "agent-a-findings.json"), "utf8"));
const totals = { dropped: 0, generalized: 0, categories: new Set() };
const staged = {};
for (const f of P.sharing.allowedFields) {
  if (raw[f] === undefined) continue; // e.g. verificationEvidence comes from the protected runner below
  const r = stageField(raw[f], raw.privateTerms);
  if (r.report.residual.length) {
    await logEvent("security", "agent-a connector", "staging_blocked", `Local gate blocked field "${f}" (${r.report.residual.join(", ")}). Nothing sent.`, "denied", "local", gen);
    say(`BLOCKED: field ${f} still contains ${r.report.residual.join(", ")}`);
    process.exit(2);
  }
  staged[f] = r.value;
  totals.dropped += r.report.droppedCredentialLines;
  totals.generalized += r.report.generalized;
  r.report.categories.forEach((c) => totals.categories.add(c));
}
// Deterministic content (no run ids or timestamps) so repeated demo rehearsals stage the same bundle and the
// exchange returns the existing submission instead of publishing a duplicate guide.
const bundle = {
  clientRequestId: "pending",
  schemaVersion: SCHEMA_VERSION,
  ...staged,
  verificationEvidence: `Protected test runner: ${base.passedCount}/${base.total} before the fix, ${cand.passedCount}/${cand.total} after (same event twice → one job; distinct events → two jobs; concurrent duplicates → one job; failed first attempt can be retried).`,
  sourceKind: "agent_resolved_bug",
  sharingLicense: "IX-DUL-1.0",
  priceAtomic: "10000",
  publicationConsent: true,
};
bundle.contentHash = await bundleHash(bundle);
bundle.clientRequestId = `a-${bundle.contentHash.slice(7, 31)}`; // idempotency key = content (not part of the hash)
await logEvent("security", "agent-a connector", "local_disclosure_gate", `Local gate dropped ${totals.dropped} credential-format line(s) (${[...totals.categories].join(", ") || "none"}) and generalized ${totals.generalized} identifier(s) before any network call.`, "ok", "local", gen);
mkdirSync(join(ROOT, "connector", ".staging"), { recursive: true });
writeFileSync(STAGED, JSON.stringify(bundle, null, 2));
say(`staged bundle ${bundle.contentHash} (dropped ${totals.dropped} credential line(s), generalized ${totals.generalized} identifier(s)) → connector/.staging/agent-a-bundle.json`);

// 5. Default: staged and unshared until the developer approves this exact hash.
await logEvent("contributor", "agent-a", "needs_approval", `Bundle ${bundle.contentHash.slice(0, 19)}… staged; waiting for developer approval.`, "pending", "local", gen);
say(`needs_approval — review connector/.staging/agent-a-bundle.json, then run: node connector/agentA.mjs --approve ${bundle.contentHash}`);
