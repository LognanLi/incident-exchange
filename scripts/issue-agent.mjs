// Operator: issue (or rotate) ONE agent credential for an organization, without touching other agents.
//   node scripts/issue-agent.mjs --name juniper-agent --org juniper \
//     [--scopes search,preview,quote,acquire,retrieve,outcome] [--max-per-purchase 10000] [--session-max 10000]
//     [--max-purchases 1] [--simulator] [--ttl-days 2]
// The client secret is written once to <name>.credentials.local (gitignored, mode 600) and never printed.
// Convex stores only its SHA-256 hash. Hand the file to the developer over a private channel.
import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(`--${k}`) ? args[args.indexOf(`--${k}`) + 1] : d);
const name = opt("name");
const org = opt("org");
if (!name || !org || !/^[a-z0-9][a-z0-9-]{2,40}$/.test(name)) {
  console.error("usage: node scripts/issue-agent.mjs --name <lowercase-name> --org <org slug> [options]");
  process.exit(2);
}
// The demo's own agents are managed by `npm run agents:setup`; don't rotate them by accident.
if (["agent-a", "agent-b"].includes(name) && !args.includes("--force")) {
  console.error(`${name} is a demo agent managed by npm run agents:setup (pass --force to rotate it here).`);
  process.exit(2);
}
const scopes = opt("scopes", "search,preview,quote,acquire,retrieve,outcome").split(",").map((s) => s.trim()).filter(Boolean);
const policy = {
  maxPerPurchaseAtomic: String(opt("max-per-purchase", "10000")),
  sessionMaxAtomic: String(opt("session-max", "10000")),
  maxPurchases: Number(opt("max-purchases", "1")),
  network: "eip155:84532",
  allowSimulator: args.includes("--simulator"),
};
const ttlDays = Number(opt("ttl-days", "2"));
const npx = (a) => execFileSync("npx", ["convex", ...a], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] }).toString();

const orgs = JSON.parse(npx(["run", "demo:listOrgs", "{}"]) || "[]");
const found = orgs.find((o) => o.slug === org);
if (!found) {
  console.error(`Unknown organization "${org}". Known: ${orgs.map((o) => o.slug).join(", ")}`);
  process.exit(2);
}
const secret = `ixa_${randomBytes(24).toString("base64url")}`;
const tokenHash = createHash("sha256").update(secret).digest("hex");
npx(["run", "mcp:upsertPrincipal", JSON.stringify({ name, orgSlug: org, scopes, tokenHash, ttlDays, policy })]);

const site = (readEnvFile(join(ROOT, ".env.local")).VITE_CONVEX_SITE_URL ?? "").replace(/\/$/, "");
const file = join(ROOT, `${name}.credentials.local`);
writeFileSync(
  file,
  [
    `# Incident Exchange agent credential for ${found.displayName} (${org}). Keep private. Expires in ${ttlDays} day(s).`,
    `IX_MCP_ENDPOINT=${site}/mcp`,
    `IX_TOKEN_ENDPOINT=${site}/oauth/token`,
    `IX_CLIENT_ID=${name}`,
    `IX_CLIENT_SECRET=${secret}`,
    "",
  ].join("\n"),
);
chmodSync(file, 0o600);
console.log(`issued ${name} for ${found.displayName} (${org})`);
console.log(`  scopes: ${scopes.join(", ")}`);
console.log(`  spend policy: ≤ ${policy.maxPerPurchaseAtomic} atomic per purchase, ≤ ${policy.sessionMaxAtomic} total, ≤ ${policy.maxPurchases} purchase(s), simulator ${policy.allowSimulator ? "allowed" : "not allowed"}`);
console.log(`  expires in ${ttlDays} day(s); credential file: ${file} (secret not printed)`);

function readEnvFile(f) {
  if (!existsSync(f)) return {};
  return Object.fromEntries(readFileSync(f, "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]));
}
