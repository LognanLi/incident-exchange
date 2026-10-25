// Applicability gate for buyer agents: runs after search and BEFORE quote/purchase or any repair.
// The exchange compares the guide's declared conditions with facts this connector established itself
// (connector/lib/facts.mjs). The decision rule lives here, in operator code, not in guide content.
import { join } from "node:path";
import { ROOT } from "./mcpClient.mjs";
import { gatherFacts } from "./facts.mjs";
import { logEvent } from "./runner.mjs";

/**
 * @param {{ c: { tool: Function }, resolutionId: string, repoRoot: string, gen: number, actor: string, say: (s: string) => void }} opts
 *   repoRoot is relative to the repository root (e.g. "sample-repos/repo-b").
 * @returns {Promise<{ proceed: boolean, result: object | null }>}
 *   proceed=false on "decline" (or if the check itself fails); "verify_first" proceeds only because the
 *   protected test runner verifies the candidate before anything is accepted.
 */
export async function applicabilityGate({ c, resolutionId, repoRoot, gen, actor, say }) {
  const facts = gatherFacts(join(ROOT, repoRoot));
  const r = await c.tool("check_applicability", { resolutionId, facts });
  if (r.isError) {
    say(`check_applicability → ${r.text}`);
    await logEvent("consumer", actor, "applicability_unavailable", `Applicability check failed (${r.text.slice(0, 120)}); not purchasing.`, "error", "local", gen);
    return { proceed: false, result: null };
  }
  const a = r.envelope.data;
  const counts = `${a.matched.length} match, ${a.conflicts.length} conflict, ${a.needsVerification.length} to verify`;
  say(`applicability → ${a.recommendation} (${counts})`);
  const yn = (b) => (b ? "yes" : "no");
  for (const m of a.matched) say(`  ✓ ${m.label}? guide needs ${yn(m.expected)}, observed ${yn(m.observed)} — ${m.source}`);
  for (const x of a.conflicts) say(`  ✗ ${x.label}? guide needs ${yn(x.expected)}, observed ${yn(x.observed)} — ${x.source}`);
  for (const n of a.needsVerification) say(`  ? ${n.label}${n.expected === null ? "" : `? guide needs ${yn(n.expected)}`} — not established`);
  if (a.recommendation === "decline") {
    say(`declining “${a.title}”: ${a.reason}`);
    return { proceed: false, result: a };
  }
  return { proceed: true, result: a };
}
