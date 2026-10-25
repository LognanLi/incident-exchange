// Agent A (contributor): fail → fix → independently verify → stage sanitized bundle → approve exact hash → submit via MCP.
//   node connector/agentA.mjs [--scenario dedupe|tenant]                 # runs, stages, prints preview + hash, stops (needs approval)
//   node connector/agentA.mjs [--scenario dedupe|tenant] --approve <hash> # developer approves that exact bundle → submit
// Scenario "dedupe" (default) is repo-a; "tenant" is repo-c. See connector/lib/scenarios.mjs.
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect, ROOT, policy } from "./lib/mcpClient.mjs";
import { enforceCandidate, snapshot } from "./lib/policy.mjs";
import { protectedRun, logEvent, generation } from "./lib/runner.mjs";
import { lineDiff } from "./lib/diff.mjs";
import { bundleHash } from "../shared/bundle.mjs";
import { parseScenario, repoPolicy, referenceFixFiles, buildBundle } from "./lib/scenarios.mjs";

const args = process.argv.slice(2);
const approveHash = args.includes("--approve") ? args[args.indexOf("--approve") + 1] : null;
const S = parseScenario(args);
const P = policy();
const STAGING = join(ROOT, "connector", ".staging");
const STAGED = join(STAGING, S.staging.bundle);
const say = (s) => console.log(`[agent-a] ${s}`);

// Approval path: submit exactly the staged bundle the developer reviewed (no re-run, no re-generation).
if (approveHash) {
  const staged = JSON.parse(readFileSync(STAGED, "utf8"));
  if (staged.contentHash !== approveHash || (await bundleHash(staged)) !== approveHash) {
    console.log("[agent-a] approval hash does not match the staged bundle — re-stage and review again");
    process.exit(3);
  }
  staged.approval = { kind: "developer_approval", reference: `dev-approval-${Date.now()}`, contentHash: approveHash };
  await logEvent("contributor", "agent-a", "developer_approval", "Developer approval matched the exact staged bundle hash; submitting through MCP.", "ok", "local", await generation(), {
    detail: { tool: "developer approval", result: "exact hash approved", evidence: [{ k: "content hash", v: approveHash }] },
  });
  const c = await connect("AGENT_A_TOKEN");
  const r = await c.tool("submit_resolution", { bundle: staged });
  console.log(`[agent-a] submit_resolution → ${r.text}`);
  await c.close();
  if (r.isError) process.exit(4);
  writeFileSync(join(STAGING, S.staging.submission), JSON.stringify(r.envelope.data, null, 2));
  process.exit(0);
}
const repoKey = S.contributorRepo;
const repo = repoPolicy(P, repoKey, ROOT, say);
const gen = await generation();
if (S.id !== "dedupe") say(`scenario: ${S.id} (${repoKey})`);

// 1–2. Isolated candidate workspace; baseline must fail.
const ws = mkdtempSync(join(tmpdir(), "ix-agent-a-"));
cpSync(join(ROOT, repo.root, "src"), join(ws, "src"), { recursive: true });
const before = snapshot(ws);
const base = await protectedRun({ repo: repoKey, candidateDir: join(ws, "src"), stage: "baseline", principalName: "agent-a", gen, note: "original code" });
say(`baseline: ${base.passedCount}/${base.total} protected tests passed (expected to fail)`);

// 3. Fix (Agent A's own fix: reference patch applied by the local connector — labeled, not attributed to Factory).
const fixes = referenceFixFiles(ROOT, repo);
for (const { from, to } of fixes) cpSync(from, join(ws, to));
const changed = enforceCandidate({ workspace: ws, before, editable: repo.editable });
const diff = fixes.map(({ to }) => lineDiff(before.get(to), readFileSync(join(ws, to), "utf8"), to)).join("\n");
const cand = await protectedRun({ repo: repoKey, candidateDir: join(ws, "src"), stage: "candidate", principalName: "agent-a", diff, changedFiles: changed, gen, note: "Agent A fix (reference patch, local connector)" });
say(`candidate: ${cand.passedCount}/${cand.total} protected tests passed`);
rmSync(ws, { recursive: true, force: true });
if (!cand.passed) {
  say("fix failed protected tests; nothing will be shared");
  process.exit(1);
}

// 4. Local disclosure gate: minimal allowed fields only, before any network call.
// Deterministic content (no run ids or timestamps) so repeated demo rehearsals stage the same bundle and the
// exchange returns the existing submission instead of publishing a duplicate guide.
const raw = JSON.parse(readFileSync(join(ROOT, "connector", "fixtures", S.findings), "utf8"));
const built = await buildBundle({ scenario: S, raw, allowedFields: P.sharing.allowedFields, base, cand });
if (built.blocked) {
  const { field, residual } = built.blocked;
  await logEvent("security", "agent-a connector", "staging_blocked", `Local gate blocked field "${field}" (${residual.join(", ")}). Nothing sent.`, "denied", "local", gen);
  say(`BLOCKED: field ${field} still contains ${residual.join(", ")}`);
  process.exit(2);
}
const { bundle, totals } = built;
await logEvent("security", "agent-a connector", "local_disclosure_gate", `Local gate dropped ${totals.dropped} credential-format line(s) (${totals.categories.join(", ") || "none"}) and generalized ${totals.generalized} identifier(s) before any network call.`, "ok", "local", gen, {
  detail: {
    tool: "local disclosure gate", input: [{ k: "allowed fields", v: P.sharing.allowedFields.join(", ") }],
    result: `${totals.dropped} credential line(s) dropped, ${totals.generalized} identifier(s) generalized, residual findings 0`,
    evidence: [{ k: "categories (no values)", v: totals.categories.join(", ") || "none" }, { k: "staged content hash", v: bundle.contentHash }],
  },
});
mkdirSync(STAGING, { recursive: true });
writeFileSync(STAGED, JSON.stringify(bundle, null, 2));
say(`staged bundle ${bundle.contentHash} (dropped ${totals.dropped} credential line(s), generalized ${totals.generalized} identifier(s)) → connector/.staging/${S.staging.bundle}`);

// 5. Default: staged and unshared until the developer approves this exact hash.
const scenarioFlag = S.id === "dedupe" ? "" : ` --scenario ${S.id}`;
await logEvent("contributor", "agent-a", "needs_approval", `Bundle ${bundle.contentHash.slice(0, 19)}… staged; waiting for developer approval.`, "pending", "local", gen, {
  detail: {
    tool: "developer approval", result: "nothing leaves the machine until the developer approves this exact hash",
    evidence: [{ k: "content hash", v: bundle.contentHash }, { k: "price (atomic)", v: bundle.priceAtomic }, { k: "conditions", v: String(bundle.conditions?.length ?? 0) }],
  },
});
say(`needs_approval — review connector/.staging/${S.staging.bundle}, then run: node connector/agentA.mjs${scenarioFlag} --approve ${bundle.contentHash}`);
