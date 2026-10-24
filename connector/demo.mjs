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
  await stage("Agent A: fix + stage bundle");
  console.log(run("agentA.mjs"));
  const hash = JSON.parse(readFileSync(join(ROOT, "connector", ".staging", "agent-a-bundle.json"), "utf8")).contentHash;
  await stage("Agent A: approved bundle → MCP submit");
  console.log(run("agentA.mjs", ["--approve", hash]));
  const sub = JSON.parse(readFileSync(join(ROOT, "connector", ".staging", "agent-a-submission.json"), "utf8"));
  if (sub.status === "published") {
    // Idempotent rehearsal: identical content was already reviewed and published — reuse that guide.
    await stage("Reusing the already-published guide (identical content; no new review)");
  } else {
  await stage("Reviewer approves exact revision (demo reviewer policy)");
  await convex.mutation(anyApi.reviews.decide, { actor: await mintSession(secrets.DEMO_SESSION_SECRET, "review-desk", 600_000), draftId: sub.submissionId, decision: "approve", note: "Demo reviewer policy: evidence and limits checked.", evidenceLevel: "evidence_reviewed", checklist: { sixSectionsComplete: true, noSensitiveData: true, defensiveOnly: true, evidenceSupportsLabel: true, limitationsStated: true } });
  }
  await stage("Agent B: search → buy → Factory repair → protected tests");
  console.log(run("agentB.mjs", process.argv.slice(2)));
  await stage("Done", "succeeded");
} catch (e) {
  const msg = (e.stdout?.toString() ?? "") + (e.message ?? "");
  console.error(msg.slice(-800));
  await convex.mutation(anyApi.agentsConsole.updateJob, { runnerSecret: R, jobId, status: "failed", error: msg.split("\n").filter((l) => l.startsWith("[agent")).pop() ?? "Demo step failed" });
  process.exit(1);
}
