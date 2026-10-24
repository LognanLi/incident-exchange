// Agent B (buyer): fail → MCP search (sanitized) → preview/fit → quote → own policy check → acquire (x402)
// → retrieve exact revision → Factory Droid adapts a fix in an isolated workspace → host policy check
// → separate protected runner → record outcome with runner evidence.
//   node connector/agentB.mjs [--simulate-payment] [--local-adapter]
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { connect, ROOT, policy } from "./lib/mcpClient.mjs";
import { enforceCandidate, snapshot, PolicyError } from "./lib/policy.mjs";
import { protectedRun, logEvent, generation } from "./lib/runner.mjs";
import { lineDiff } from "./lib/diff.mjs";
import { buildPrompt, factoryAvailable, runDroid } from "./lib/factoryRepair.mjs";

const args = process.argv.slice(2);
const simulate = args.includes("--simulate-payment");
const P = policy();
const repo = P.repos["repo-b"];
const editable = repo.editable[0];
const gen = await generation();
const say = (s) => console.log(`[agent-b] ${s}`);
const result = { stages: [] };
const stage = (name, data) => (result.stages.push({ name, at: new Date().toISOString(), ...data }), data);

// 1. Isolated candidate workspace (source only — no tests, no git, no env files); baseline must fail.
const ws = mkdtempSync(join(tmpdir(), "ix-agent-b-"));
cpSync(join(ROOT, repo.root, "src"), join(ws, "src"), { recursive: true });
const before = snapshot(ws);
const base = await protectedRun({ repo: "repo-b", candidateDir: join(ws, "src"), stage: "baseline", principalName: "agent-b", gen, note: "original code" });
say(`baseline: ${base.passedCount}/${base.total} protected tests passed`);
stage("baseline", { passed: base.passed, passedCount: base.passedCount, total: base.total, runId: base.runId });
const failing = base.tests.filter((t) => !t.ok).map((t) => t.name);

// 2. Sanitized query built from failing test names + environment facts (no repo, no raw logs).
const c = await connect("AGENT_B_TOKEN");
const symptoms = `Same message delivered twice creates two queued tasks; concurrent duplicate deliveries also duplicate work; provider retries the same message id. Failing checks: ${failing.join("; ")}`.slice(0, 600);
const search = await c.tool("search_resolutions", { symptoms, environment: ["Message queue consumer", "Webhooks", "Node.js"] });
if (search.isError) {
  say(`search → ${search.text}`);
  await logEvent("consumer", "agent-b", "abstain", "No applicable resolution; agent abstains instead of forcing a fix.", "ok", "local", gen);
  process.exit(0);
}
const pick = search.envelope.data.find((r) => r.relevance === "strong_overlap" && BigInt(r.price.amountAtomic) <= BigInt(P.payment.maxPerPurchaseAtomic));
say(`search → ${search.envelope.data.length} result(s); top: “${search.envelope.data[0].title}” (${search.envelope.data[0].relevanceLabel}, ${search.envelope.data[0].price.amountAtomic} atomic)`);
if (!pick) {
  await logEvent("consumer", "agent-b", "abstain", "No strong-overlap resolution within budget; agent abstains.", "ok", "local", gen);
  say("no strong-overlap result within budget → abstain");
  process.exit(0);
}
await logEvent("consumer", "agent-b", "search_resolutions", `Found “${pick.title}” via MCP (${pick.relevanceLabel}; ${search.envelope.provenance?.sourceIds?.[0] ?? "search"}).`, "ok", search.envelope.provenance?.mode ?? "local", gen);
stage("search", { resolutionId: pick.resolutionId, matched: pick.matchedClues, missing: pick.missingChecks, conflicts: pick.conflictingClues.length });

// Already entitled (e.g. a re-run after reload)? Reuse the existing receipt — never pay twice.
const existing = await c.tool("get_resolution", { resolutionId: pick.resolutionId });
let resolutionCached = null;
if (!existing.isError) {
  resolutionCached = existing.envelope.data;
  say(`already entitled to rev ${resolutionCached.revision} (purchase ${resolutionCached.purchaseId}) — no new payment`);
  await logEvent("consumer", "agent-b", "entitlement_reused", `Already entitled to rev ${resolutionCached.revision} — reused the earlier purchase; no new payment.`, "ok", "local", gen);
  stage("acquire", { mode: "existing_entitlement", purchaseId: resolutionCached.purchaseId });
}

// 3. Quote + the connector's OWN policy check (payee/network/budget pinned by the operator, not by content).
if (!resolutionCached) {
const quote = await c.tool("quote_resolution", { resolutionId: pick.resolutionId });
if (quote.isError) throw new Error(quote.text);
const q = quote.envelope.data;
const okTerms = q.payTo.toLowerCase() === String(P.payment.payTo).toLowerCase() && q.network === P.payment.network && String(q.asset ?? "").toLowerCase() === String(P.payment.asset).toLowerCase() && BigInt(q.price.amountAtomic) <= BigInt(P.payment.maxPerPurchaseAtomic);
if (!okTerms) {
  await logEvent("security", "agent-b connector", "quote_rejected", "Quote terms differ from the operator's pinned payee/network/budget — no spend.", "denied", "local", gen);
  say("quote terms violate local policy → refused");
  process.exit(5);
}
say(`quote ${q.quoteId}: ${q.price.amountAtomic} atomic USDC → ${q.payTo.slice(0, 10)}… on ${q.network}; within policy`);

// 4. Acquire (payment via the server-held signer; explicit simulator only if requested).
const acq = await c.tool("acquire_resolution", { quoteId: q.quoteId, clientRequestId: `b-${gen}-${randomUUID().slice(0, 8)}`, approved: { payTo: P.payment.payTo, maxAmountAtomic: P.payment.maxPerPurchaseAtomic, network: P.payment.network, asset: P.payment.asset }, paymentMode: simulate ? "simulator" : "x402_testnet" });
say(`acquire → ${acq.text}`);
if (acq.isError) process.exit(6);
stage("acquire", { mode: acq.envelope.provenance.mode, txHash: acq.envelope.data?.txHash });
}

// 5. Retrieve the exact entitled revision (untrusted evidence).
let resolution = resolutionCached;
if (!resolution) {
  const res = await c.tool("get_resolution", { resolutionId: pick.resolutionId });
  if (res.isError) throw new Error(res.text);
  resolution = res.envelope.data;
}
say(`retrieved rev ${resolution.revision} (${resolution.revisionHash.slice(0, 22)}…) — trust: ${resolution.trust}`);

// 6. Repair: Factory Droid adapts the lesson inside the isolated workspace.
let tool;
let droid = null;
if (factoryAvailable() && !args.includes("--local-adapter")) {
  tool = "Factory Droid (droid exec: Read/LS/ApplyPatch, isolated workspace)";
  await logEvent("consumer", "agent-b", "factory_repair_started", "Factory Droid is adapting the purchased lesson in an isolated copy of repo B.", "pending", "live", gen);
  droid = await runDroid({ cwd: ws, prompt: buildPrompt({ editable, resolution }) });
  say(`factory droid: ${droid.ok ? "ok" : "failed"} in ${Math.round(droid.durationMs / 1000)}s — ${droid.summary}`);
} else {
  tool = "Factory unavailable — no repair attempted";
  say("Factory Droid unavailable (FACTORY_API_KEY or CLI missing): labeled unavailable; no fake repair.");
  await logEvent("consumer", "agent-b", "factory_unavailable", "Factory Droid unavailable; repair step skipped (not simulated).", "error", "unavailable", gen);
  process.exit(7);
}

// 7. Host policy (outside the model): only the editable file may change; no symlinks/new files/tests.
let changed = [];
try {
  changed = enforceCandidate({ workspace: ws, before, editable: [editable] });
} catch (e) {
  const code = e instanceof PolicyError ? e.code : "policy_error";
  await logEvent("security", "agent-b connector", "patch_rejected", `Candidate rejected by host policy (${code}); workspace discarded, original repo untouched.`, "denied", "local", gen);
  say(`candidate REJECTED by host policy: ${code}`);
  rmSync(ws, { recursive: true, force: true });
  process.exit(8);
}
const diff = changed.length ? lineDiff(before.get(editable), readFileSync(join(ws, editable), "utf8"), editable) : "";

// 8. Separate protected test runner on the candidate.
const cand = await protectedRun({ repo: "repo-b", candidateDir: join(ws, "src"), stage: "candidate", principalName: "agent-b", resolutionId: pick.resolutionId, diff, changedFiles: changed, gen, mode: droid ? "live" : "local", note: `${tool}${droid?.sessionId ? ` · session ${droid.sessionId.slice(0, 8)}` : ""}` });
say(`candidate: ${cand.passedCount}/${cand.total} protected tests passed (${cand.passed ? "ACCEPTED" : "REJECTED — discarded"})`);
stage("candidate", { passed: cand.passed, passedCount: cand.passedCount, total: cand.total, runId: cand.runId, changed, tool });

// 9. Outcome tied to the revision and the runner's evidence id.
const out = await c.tool("record_outcome", { resolutionId: pick.resolutionId, passed: cand.passed, evidenceRunId: cand.runId, summary: `Adapted fix in repo B; protected tests ${cand.passedCount}/${cand.total}.` });
say(`record_outcome → ${out.text}`);
await c.close();
rmSync(ws, { recursive: true, force: true });

mkdirSync(join(ROOT, "connector", ".staging"), { recursive: true });
writeFileSync(join(ROOT, "connector", ".staging", "agent-b-result.json"), JSON.stringify({ ...result, diff, droid: droid && { summary: droid.summary, sessionId: droid.sessionId, durationMs: droid.durationMs } }, null, 2));
if (diff) console.log(diff);
process.exit(cand.passed ? 0 : 9);
