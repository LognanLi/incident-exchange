// Demo scenarios for the two-agent connectors. Pure: no network, no Convex, no runner. Everything that
// decides what Agent A shares lives in buildBundle() so it can be checked offline (tests/scenarios.test.ts).
//   dedupe (default): repo-a → repo-b, duplicate webhook/message deliveries (scenario 1, unchanged)
//   tenant:           repo-c → repo-d, cross-tenant read by client-supplied id (scenario 2)
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { bundleHash, SCHEMA_VERSION } from "../../shared/bundle.mjs";
import { validateConditions } from "../../shared/applicability.mjs";
import { stageField } from "./policy.mjs";

export const SCENARIO_IDS = ["dedupe", "tenant"];

export const SCENARIOS = {
  dedupe: {
    id: "dedupe",
    contributorRepo: "repo-a",
    buyerRepo: "repo-b",
    findings: "agent-a-findings.json",
    priceAtomic: "10000",
    // Scenario 1 keeps its original staging file names.
    staging: { bundle: "agent-a-bundle.json", submission: "agent-a-submission.json", result: "agent-b-result.json" },
    verificationEvidence: (b, c) =>
      `Protected test runner: ${b.passedCount}/${b.total} before the fix, ${c.passedCount}/${c.total} after (same event twice → one job; distinct events → two jobs; concurrent duplicates → one job; failed first attempt can be retried).`,
    symptoms: (failing) =>
      `Same message delivered twice creates two queued tasks; concurrent duplicate deliveries also duplicate work; provider retries the same message id. Failing checks: ${failing.join("; ")}`.slice(0, 600),
    environment: ["Message queue consumer", "Webhooks", "Node.js"],
    task: undefined, // buildPrompt's default (scenario 1) task text
    outcomeSummary: (c) => `Adapted fix in repo B; protected tests ${c.passedCount}/${c.total}.`,
  },
  tenant: {
    id: "tenant",
    contributorRepo: "repo-c",
    buyerRepo: "repo-d",
    findings: "agent-a-tenant-findings.json",
    priceAtomic: "10000",
    staging: { bundle: "agent-a-tenant-bundle.json", submission: "agent-a-tenant-submission.json", result: "agent-b-tenant-result.json" },
    verificationEvidence: (b, c) =>
      `Protected test runner: ${b.passedCount}/${b.total} before the fix, ${c.passedCount}/${c.total} after (same-tenant read and void still work; another tenant's record → not_found, identical to a missing id, with no data returned; cross-tenant void refused and leaves the record unchanged).`,
    symptoms: (failing) =>
      `Members of one workspace can download or delete another workspace's records by changing the record id in the URL; responses for other workspaces' ids differ from unknown ids. Failing checks: ${failing.join("; ")}`.slice(0, 600),
    environment: ["Multi-tenant SaaS", "REST API", "Authorization", "Node.js"],
    task: (editable) =>
      `Task: make a minimal defensive fix in ${editable} so a caller can only read or change records that belong to the caller's own authenticated workspace; another workspace's record must get exactly the same response as an unknown id (no data, no hint that it exists) and must not be modified; legitimate same-workspace access must keep working.`,
    outcomeSummary: (c) => `Adapted tenant-ownership fix in repo D; protected tests ${c.passedCount}/${c.total}.`,
  },
};

/** `--scenario <id>` from argv; default "dedupe". Unknown ids throw (never silently fall back). */
export function parseScenario(argv) {
  const i = argv.indexOf("--scenario");
  if (i === -1) return SCENARIOS.dedupe;
  const id = argv[i + 1];
  if (!SCENARIO_IDS.includes(id)) throw new Error(`--scenario must be one of: ${SCENARIO_IDS.join(", ")}`);
  return SCENARIOS[id];
}

/**
 * Operator policy for a repo. connector/policy.local.json wins; repos missing there fall back to the committed
 * sample-repos/manifest.json `editable` list (reported through `log`, never silent).
 */
export function repoPolicy(P, key, root, log = () => {}) {
  if (P?.repos?.[key]) return P.repos[key];
  const manifest = JSON.parse(readFileSync(join(root, "sample-repos", "manifest.json"), "utf8"));
  const m = manifest[key];
  if (!m || !Array.isArray(m.editable) || !m.editable.length) throw new Error(`No policy for ${key} in connector/policy.local.json or sample-repos/manifest.json`);
  log(`policy.local.json has no entry for ${key}; using sample-repos/manifest.json editable list (${m.editable.join(", ")})`);
  return { root: `sample-repos/${key}`, editable: [...m.editable] };
}

/** Reference-fix files for a contributor repo: reference-fix/<path under src/> replaces src/<path>. */
export function referenceFixFiles(root, repo) {
  return repo.editable.map((f) => {
    if (!f.startsWith("src/")) throw new Error(`editable file outside src/: ${f}`);
    const from = join(root, repo.root, "reference-fix", f.slice("src/".length));
    if (!existsSync(from)) throw new Error(`missing reference fix for ${f}`);
    return { from, to: f };
  });
}

/**
 * Local disclosure gate + deterministic bundle. `base`/`cand` are protected-run results ({ passedCount, total }).
 * Returns { blocked } when a field still has residual sensitive content (nothing must be sent), else
 * { bundle, totals }. Deterministic: no run ids or timestamps, so identical inputs give the identical hash.
 */
export async function buildBundle({ scenario, raw, allowedFields, base, cand }) {
  const totals = { dropped: 0, generalized: 0, categories: new Set() };
  const staged = {};
  for (const f of allowedFields) {
    if (raw[f] === undefined) continue; // e.g. verificationEvidence comes from the protected runner below
    const r = stageField(raw[f], raw.privateTerms);
    if (r.report.residual.length) return { blocked: { field: f, residual: r.report.residual } };
    staged[f] = r.value;
    totals.dropped += r.report.droppedCredentialLines;
    totals.generalized += r.report.generalized;
    r.report.categories.forEach((c) => totals.categories.add(c));
  }
  const bundle = {
    clientRequestId: "pending",
    schemaVersion: SCHEMA_VERSION,
    ...staged,
    verificationEvidence: scenario.verificationEvidence(base, cand),
    sourceKind: "agent_resolved_bug",
    sharingLicense: "IX-DUL-1.0",
    priceAtomic: scenario.priceAtomic,
    publicationConsent: true,
  };
  // Optional structured conditions (exchange fact vocabulary only). Scenario 1's fixture has none, so its hash is unchanged.
  if (raw.conditions !== undefined) {
    const conditions = validateConditions(raw.conditions);
    const r = stageField(conditions.map((c) => c.note ?? "").filter(Boolean), raw.privateTerms);
    if (r.report.residual.length || r.report.droppedCredentialLines || r.report.generalized) return { blocked: { field: "conditions", residual: r.report.residual.length ? r.report.residual : ["note_needs_generalization"] } };
    bundle.conditions = conditions;
  }
  bundle.contentHash = await bundleHash(bundle);
  bundle.clientRequestId = `a-${bundle.contentHash.slice(7, 31)}`; // idempotency key = content (not part of the hash)
  return { bundle, totals: { ...totals, categories: [...totals.categories] } };
}
