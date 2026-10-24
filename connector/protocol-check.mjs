// Protocol proof: real client ↔ HTTP MCP server. Prints no secrets.
import { connect } from "./lib/mcpClient.mjs";
const c = await connect("AGENT_B_TOKEN");
console.log("negotiated protocol:", c.client.transport?.protocolVersion ?? "(see server)", "| server:", JSON.stringify(c.client.getServerVersion()));
const tools = await c.client.listTools();
console.log("tools/list:", tools.tools.map((t) => t.name).join(", "));
const cap = await c.tool("get_exchange_capabilities");
console.log("capabilities:", cap.text);
const s = await c.tool("search_resolutions", { symptoms: "identical webhook event ids create two jobs and the queue refills after restarting workers", environment: ["Webhooks"] });
console.log("search:", s.isError ? s.text : s.text);
const bad = await c.tool("search_resolutions", { symptoms: "x" }).catch((e) => ({ isError: true, text: `protocol error: ${e.message.slice(0, 120)}` }));
console.log("invalid input:", bad.text);
const unrelated = await c.tool("search_resolutions", { symptoms: "how do I bake sourdough bread at home", environment: [] });
console.log("unrelated:", unrelated.text);
const forbidden = await c.tool("submit_resolution", { bundle: { clientRequestId: "abcdefgh12", schemaVersion: "1", summary: "x", symptoms: [], environmentCategories: [], rootCauseEvidence: "", unsuccessfulApproaches: [], fixPattern: "", verificationEvidence: "", applicability: [], limitations: [], sourceKind: "agent_resolved_bug", sharingLicense: "IX-DUL-1.0", priceAtomic: "10000", contentHash: "x", approval: { kind: "developer_approval", reference: "x", contentHash: "x" }, publicationConsent: false } });
console.log("buyer token calling submit:", forbidden.text);
await c.close();
for (const [label, headers] of [["no token", {}], ["bogus token", { Authorization: "Bearer ixa_bogus_token_value_that_is_long_enough" }]]) {
  const r = await fetch("http://127.0.0.1:8787/mcp", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...headers }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "get_resolution_preview", arguments: { resolutionId: "x" } } }) });
  const t = await r.text();
  console.log(`${label}: HTTP ${r.status} ${t.match(/AUTH_REQUIRED[^"]*/)?.[0] ?? t.slice(0, 100)}`);
}
