// Operator setup for the agent-to-agent demo. Never prints secret values.
// - Ensures MCP_SERVICE_SECRET + DEMO_SESSION_SECRET (generated) and FACTORY_RUNNER_SECRET (reused) exist locally and on Convex.
// - Issues fresh dev service tokens for agent-a (contributor) and agent-b (buyer); only SHA-256 hashes go to Convex.
// - Writes the connector's pinned policy (endpoint, network, payee, budget).
import { execFileSync } from "node:child_process";
import { randomBytes, createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const SECRETS = join(ROOT, ".secrets.local");
const TOKENS = join(ROOT, ".agent-tokens.local");
const npx = (args, input) => execFileSync("npx", ["convex", ...args], { cwd: ROOT, input, stdio: ["pipe", "pipe", "pipe"] }).toString();

const readEnv = (f) => (existsSync(f) ? Object.fromEntries(readFileSync(f, "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)])) : {});
const secrets = readEnv(SECRETS);
const cloudNames = new Set(npx(["env", "list"]).split("\n").map((l) => l.split("=")[0].trim()).filter(Boolean));

function ensure(name, generate) {
  let value = secrets[name];
  if (!value) {
    if (!generate) throw new Error(`${name} missing from .secrets.local`);
    value = randomBytes(24).toString("hex");
    writeFileSync(SECRETS, `${readFileSync(SECRETS, "utf8").replace(/\n?$/, "\n")}${name}=${value}\n`);
    chmodSync(SECRETS, 0o600);
    console.log(`generated ${name} (stored in .secrets.local)`);
  }
  if (!cloudNames.has(name)) {
    npx(["env", "set", name, value]);
    console.log(`set ${name} on the Convex deployment`);
  } else console.log(`${name} already set on the Convex deployment (kept)`);
}
ensure("FACTORY_RUNNER_SECRET", false);
ensure("MCP_SERVICE_SECRET", true);
ensure("DEMO_SESSION_SECRET", true);

const AGENTS = [
  { name: "agent-a", env: "AGENT_A_TOKEN", orgSlug: "northstar", scopes: ["search", "preview", "submit", "status"], policy: { maxPerPurchaseAtomic: "0", sessionMaxAtomic: "0", maxPurchases: 0, network: "eip155:84532" } },
  { name: "agent-b", env: "AGENT_B_TOKEN", orgSlug: "harbor", scopes: ["search", "preview", "quote", "acquire", "retrieve", "outcome"], policy: { maxPerPurchaseAtomic: "10000", sessionMaxAtomic: "50000", maxPurchases: 2, network: "eip155:84532", allowSimulator: true } },
];
const lines = ["# Dev service tokens for the demo agents (gitignored). Rotate with `npm run agents:setup`."];
for (const a of AGENTS) {
  const token = `ixa_${randomBytes(24).toString("base64url")}`;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  npx(["run", "mcp:upsertPrincipal", JSON.stringify({ name: a.name, orgSlug: a.orgSlug, scopes: a.scopes, tokenHash, ttlDays: 7, policy: a.policy })]);
  lines.push(`${a.env}=${token}`);
  console.log(`issued ${a.name} token (scopes: ${a.scopes.join(", ")}; expires in 7 days)`);
}
writeFileSync(TOKENS, lines.join("\n") + "\n");
chmodSync(TOKENS, 0o600);

const wallets = JSON.parse(npx(["run", "x402State:getWallets"]) || "{}");
const policy = {
  exchangeEndpoint: "http://127.0.0.1:8787/mcp",
  payment: { network: "eip155:84532", asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", payTo: wallets.receiver?.address ?? "simulator", maxPerPurchaseAtomic: "10000", sessionMaxAtomic: "50000" },
  repos: {
    "repo-a": { root: "sample-repos/repo-a", editable: ["src/handler.mjs"] },
    "repo-b": { root: "sample-repos/repo-b", editable: ["src/consumer/messageConsumer.mjs"] },
  },
  sharing: { allowedFields: ["summary", "symptoms", "environmentCategories", "rootCauseEvidence", "unsuccessfulApproaches", "fixPattern", "verificationEvidence", "applicability", "limitations"], publication: "requires_developer_approval" },
  namedTasks: { protected_tests: "sample-repos/run-protected-tests.mjs" },
};
writeFileSync(join(ROOT, "connector", "policy.local.json"), JSON.stringify(policy, null, 2) + "\n");
console.log(`wrote connector/policy.local.json (payee pinned to ${policy.payment.payTo})`);
