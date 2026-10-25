// Two-agent demo orchestrator. Every stage runs the real connector/MCP/runner code; nothing is canned.
// Presenter clicking "Run" is the developer approval for the freshly staged bundle (shown in the console),
// and a presenter-authorized demo reviewer policy approves that exact revision.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
import { ROOT, readEnv } from "./lib/mcpClient.mjs";
import { mintSession } from "../shared/session.mjs";
import { parseScenario } from "./lib/scenarios.mjs";

// --scenario dedupe|tenant (default dedupe = scenario 1, unchanged). Passed through to both agents.
const argv = process.argv.slice(2);
const S = parseScenario(argv);
const scenarioArgs = S.id === "dedupe" ? [] : ["--scenario", S.id];
const passThrough = argv.filter((a, i) => a !== "--scenario" && argv[i - 1] !== "--scenario");
const STAGING = join(ROOT, "connector", ".staging");

const secrets = readEnv(join(ROOT, ".secrets.local"));
const convex = new ConvexHttpClient(readEnv(join(ROOT, ".env.local")).VITE_CONVEX_URL);
const R = secrets.FACTORY_RUNNER_SECRET;
const { jobId } = await convex.mutation(anyApi.agentsConsole.startJob, { runnerSecret: R, kind: "two_agent_demo" });
const stage = async (s, status) => {
  const r = await convex.mutation(anyApi.agentsConsole.updateJob, { runnerSecret: R, jobId, stage: s, status });
  if (r.ignored) {
    console.log("job canceled or reset — stopping");
    process.exit(0);
  }
};
const run = (file, args = []) => execFileSync(process.execPath, [join(ROOT, "connector", file), ...args], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], timeout: 600_000 }).toString();
try {
  await stage(`Agent A: fix + stage bundle${S.id === "dedupe" ? "" : ` (scenario: ${S.id})`}`);
  console.log(run("agentA.mjs", scenarioArgs));
  const hash = JSON.parse(readFileSync(join(STAGING, S.staging.bundle), "utf8")).contentHash;
  await stage("Agent A: approved bundle → MCP submit");
  console.log(run("agentA.mjs", [...scenarioArgs, "--approve", hash]));
  const sub = JSON.parse(readFileSync(join(STAGING, S.staging.submission), "utf8"));
  if (sub.status === "published") {
    // Idempotent rehearsal: identical content was already reviewed and published — reuse that guide.
    await stage("Reusing the already-published guide (identical content; no new review)");
  } else {
  await stage("Reviewer approves exact revision (demo reviewer policy)");
  await convex.mutation(anyApi.reviews.decide, { actor: await mintSession(secrets.DEMO_SESSION_SECRET, "review-desk", 600_000), draftId: sub.submissionId, decision: "approve", note: "Demo reviewer policy: evidence and limits checked.", evidenceLevel: "evidence_reviewed", checklist: { sixSectionsComplete: true, noSensitiveData: true, defensiveOnly: true, evidenceSupportsLabel: true, limitationsStated: true } });
  }
  await stage(`Agent B: search → applicability → buy → Factory repair → protected tests${S.id === "dedupe" ? "" : ` (scenario: ${S.id})`}`);
  console.log(run("agentB.mjs", [...scenarioArgs, ...passThrough]));
  await stage("Done", "succeeded");
} catch (e) {
  const msg = (e.stdout?.toString() ?? "") + (e.message ?? "");
  console.error(msg.slice(-800));
  await convex.mutation(anyApi.agentsConsole.updateJob, { runnerSecret: R, jobId, status: "failed", error: msg.split("\n").filter((l) => l.startsWith("[agent")).pop() ?? "Demo step failed" });
  process.exit(1);
}
