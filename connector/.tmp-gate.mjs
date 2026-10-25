import { connect } from "./lib/mcpClient.mjs";
import { applicabilityGate } from "./lib/applicability.mjs";
const c = await connect("AGENT_B_TOKEN");
const r = await applicabilityGate({ c, resolutionId: process.argv[2], repoRoot: process.argv[3], gen: 0, actor: "agent-b", say: (s) => console.log(s) });
console.log("proceed:", r.proceed);
await c.close();
