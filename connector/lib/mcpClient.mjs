// Real MCP client (official SDK, Streamable HTTP). The bearer token is held here, never logged.
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export const ROOT = resolve(import.meta.dirname, "..", "..");
export const readEnv = (f) =>
  existsSync(f) ? Object.fromEntries(readFileSync(f, "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])) : {};
export const policy = () => JSON.parse(readFileSync(join(ROOT, "connector", "policy.local.json"), "utf8"));

export async function connect(agentEnvName, { endpoint } = {}) {
  const tokens = readEnv(join(ROOT, ".agent-tokens.local"));
  const token = process.env[agentEnvName] ?? tokens[agentEnvName];
  if (!token) throw new Error(`Missing ${agentEnvName}; run npm run agents:setup`);
  // Pinned exchange endpoint from the operator policy — never from retrieved content.
  const url = new URL(endpoint ?? policy().exchangeEndpoint);
  const transport = new StreamableHTTPClientTransport(url, { requestInit: { headers: { Authorization: `Bearer ${token}` } } });
  const client = new Client({ name: `incident-exchange-connector/${agentEnvName}`, version: "1.0.0" });
  await client.connect(transport);
  return {
    client,
    /** Call a tool; returns the structured envelope. Throws on MCP protocol errors. */
    async tool(name, args = {}) {
      const r = await client.callTool({ name, arguments: args });
      return { isError: !!r.isError, text: r.content?.[0]?.text ?? "", envelope: r.structuredContent };
    },
    close: () => client.close(),
  };
}
