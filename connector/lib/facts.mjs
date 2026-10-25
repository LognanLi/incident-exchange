// Environment facts for applicability checking, gathered by the buyer's OWN connector.
// The probe list is fixed in this file. Retrieved guides cannot add probes, commands, paths or fact keys:
// the connector only answers the exchange's fixed vocabulary (shared/applicability.mjs), and only from
//   1. static reads of its own repository's interface file (src/ports.mjs), or
//   2. facts the developer declared in <repo>/environment-facts.json.
// A fact it cannot establish is left out, so the exchange reports it as "needs verification".
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { FACT_KEYS, validateFacts } from "../../shared/applicability.mjs";

const read = (f) => (existsSync(f) ? readFileSync(f, "utf8") : null);

/** Fixed probes over src/ports.mjs (interface docs only; never executes repository code). */
const PROBES = [
  {
    fact: "store.atomic_claim",
    test: (ports) => /claim\s+Atomically|@property\s+\{\(id: string\) => Promise<boolean>\}\s+claim/.test(ports),
    yes: "src/ports.mjs documents an atomic claim(id) → boolean",
    no: "src/ports.mjs documents no atomic claim operation",
  },
  {
    fact: "records.tenant_scoped",
    test: (ports) => /@property\s+\{string\}\s+(tenantId|workspaceId|orgId)\b/.test(ports),
    yes: "src/ports.mjs: records carry an owning tenant/workspace id",
    no: "src/ports.mjs: records carry no tenant/workspace field",
  },
  {
    fact: "request.authenticated_tenant",
    test: (ports) => /auth\.(tenantId|workspaceId|orgId)\b/.test(ports),
    yes: "src/ports.mjs: requests carry the authenticated tenant/workspace",
    no: "src/ports.mjs: requests carry no authenticated tenant/workspace",
  },
  {
    fact: "access.fetch_by_client_id",
    test: (ports) => /params\.\w+Id\b/.test(ports),
    yes: "src/ports.mjs: records are fetched by a client-supplied id (params.*Id)",
    no: null, // absence proves nothing here
  },
];

/**
 * @param {string} repoRoot  absolute path of the buyer repository (not the candidate workspace)
 * @returns {{ fact: string, value: boolean, source: string }[]}
 */
export function gatherFacts(repoRoot) {
  const facts = new Map();
  const src = join(repoRoot, "src");
  if (existsSync(src) && readdirSync(src, { recursive: true }).some((f) => String(f).endsWith(".mjs"))) {
    facts.set("runtime.node", { fact: "runtime.node", value: true, source: "probe: source is Node.js ES modules (.mjs)" });
  }
  const ports = read(join(src, "ports.mjs"));
  if (ports) {
    for (const p of PROBES) {
      const hit = p.test(ports);
      if (hit) facts.set(p.fact, { fact: p.fact, value: true, source: `probe: ${p.yes}` });
      else if (p.no) facts.set(p.fact, { fact: p.fact, value: false, source: `probe: ${p.no}` });
    }
  }
  // Developer declarations win over probes: they are the operator's own statements about the system.
  const declared = read(join(repoRoot, "environment-facts.json"));
  if (declared) {
    const doc = JSON.parse(declared);
    for (const [fact, value] of Object.entries(doc.facts ?? {})) {
      if (!FACT_KEYS.includes(fact) || typeof value !== "boolean") continue; // ignore anything outside the vocabulary
      facts.set(fact, { fact, value, source: "declared by the developer in environment-facts.json" });
    }
  }
  return validateFacts([...facts.values()]);
}
