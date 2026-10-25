// Fit check from the terminal: Agent B's connector gathers facts about a repository with its fixed probes and
// asks the exchange whether a guide applies. Read-only besides the recorded check; never buys anything.
//   node connector/fit-check.mjs <resolutionId> [repoRoot=sample-repos/repo-b]
// Example decline: the tenant guide against repo-b (a message consumer with no tenants).
import { connect } from "./lib/mcpClient.mjs";
import { applicabilityGate } from "./lib/applicability.mjs";

const [resolutionId, repoRoot = "sample-repos/repo-b"] = process.argv.slice(2);
if (!resolutionId) {
  console.error("usage: node connector/fit-check.mjs <resolutionId> [repoRoot]");
  process.exit(2);
}
const c = await connect("AGENT_B_TOKEN");
const r = await applicabilityGate({ c, resolutionId, repoRoot, gen: 0, actor: "agent-b", say: (s) => console.log(s) });
console.log(r.proceed ? "→ would proceed (protected tests still decide)" : "→ declined: no quote, no purchase, no repair");
await c.close();
