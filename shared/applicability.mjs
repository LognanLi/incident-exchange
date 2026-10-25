// Applicability checking, shared by the Convex backend (check_applicability) and the connectors.
// Plain ESM, no Node built-ins.
//
// A guide declares conditions over an exchange-defined fact vocabulary. A buyer's connector reports facts it
// established with its OWN fixed probes, or that its operator declared. The exchange compares the two. Nothing
// here runs code. Guide text cannot add probes, commands or fact keys: unknown keys are rejected on both sides.
// No confidence scores: every result is a list of named conditions with the evidence behind each.

/** Exchange-defined facts. Keys are stable; labels are display text. */
export const FACTS = {
  "runtime.node": { label: "The service runs on Node.js" },
  "delivery.stable_message_ids": { label: "Retried deliveries carry the same message or event id" },
  "store.atomic_claim": { label: "The store offers an atomic claim / insert-if-absent on that id" },
  "duplicates.distinct_ids": { label: "Duplicates arrive with different ids" },
  "records.tenant_scoped": { label: "Each record stores the tenant or workspace that owns it" },
  "request.authenticated_tenant": { label: "The caller's authenticated tenant or workspace is available server-side" },
  "access.fetch_by_client_id": { label: "Records are looked up by an id the client supplies" },
  "access.cross_tenant_sharing": { label: "Legitimate cross-tenant access exists (shared links, partner or support access)" },
};
export const FACT_KEYS = Object.keys(FACTS);

/** Limits for validation on both sides. */
export const APPLICABILITY_LIMITS = { conditions: 12, facts: 16, note: 200, source: 160 };

/**
 * @typedef {{ fact: string, expected: boolean, note?: string }} Condition
 *   The guide applies only when `fact` has the `expected` value.
 * @typedef {{ fact: string, value: boolean, source: string }} Fact
 *   `source` says how the buyer's connector knows (e.g. "probe: src/ports.mjs declares claim()").
 */

/** Throws on malformed input. Returns cleaned copies. */
export function validateConditions(conditions) {
  if (!Array.isArray(conditions) || conditions.length > APPLICABILITY_LIMITS.conditions) throw new Error("conditions must be a list of at most 12");
  const seen = new Set();
  return conditions.map((c) => {
    if (!c || typeof c !== "object" || !FACT_KEYS.includes(c.fact)) throw new Error(`unknown fact key: ${String(c?.fact).slice(0, 60)}`);
    if (typeof c.expected !== "boolean") throw new Error("condition.expected must be a boolean");
    if (seen.has(c.fact)) throw new Error(`duplicate condition for ${c.fact}`);
    seen.add(c.fact);
    const note = typeof c.note === "string" ? c.note.slice(0, APPLICABILITY_LIMITS.note) : undefined;
    return { fact: c.fact, expected: c.expected, ...(note ? { note } : {}) };
  });
}

export function validateFacts(facts) {
  if (!Array.isArray(facts) || facts.length > APPLICABILITY_LIMITS.facts) throw new Error("facts must be a list of at most 16");
  const seen = new Set();
  return facts.map((f) => {
    if (!f || typeof f !== "object" || !FACT_KEYS.includes(f.fact)) throw new Error(`unknown fact key: ${String(f?.fact).slice(0, 60)}`);
    if (typeof f.value !== "boolean") throw new Error("fact.value must be a boolean");
    if (seen.has(f.fact)) throw new Error(`duplicate fact ${f.fact}`);
    seen.add(f.fact);
    return { fact: f.fact, value: f.value, source: String(f.source ?? "unspecified").slice(0, APPLICABILITY_LIMITS.source) };
  });
}

/**
 * Compare guide conditions with buyer facts.
 * - matched: the fact is known and equals the expected value
 * - conflicts: the fact is known and differs: the guide does not apply as written
 * - needsVerification: the guide needs the fact but the buyer has not established it
 * Recommendation: "decline" on any conflict; "recommend" when every condition matched; otherwise "verify_first".
 * A guide without structured conditions is never "recommend".
 */
export function evaluateApplicability(conditions, facts, { freeTextChecks = [] } = {}) {
  const byFact = new Map(facts.map((f) => [f.fact, f]));
  const matched = [];
  const conflicts = [];
  const needsVerification = [];
  for (const c of conditions) {
    const label = FACTS[c.fact].label;
    const f = byFact.get(c.fact);
    const item = { fact: c.fact, label, expected: c.expected, ...(c.note ? { note: c.note } : {}) };
    if (!f) needsVerification.push(item);
    else if (f.value === c.expected) matched.push({ ...item, observed: f.value, source: f.source });
    else conflicts.push({ ...item, observed: f.value, source: f.source });
  }
  // Free-text checks from guides that predate structured conditions: shown, never auto-matched.
  for (const text of freeTextChecks.slice(0, APPLICABILITY_LIMITS.conditions)) needsVerification.push({ fact: null, label: String(text).slice(0, 300), expected: null });
  let recommendation;
  let reason;
  if (conflicts.length) {
    recommendation = "decline";
    reason = `${conflicts.length} condition(s) conflict with your environment: ${conflicts.map((c) => c.label).join("; ")}.`;
  } else if (conditions.length && !needsVerification.length) {
    recommendation = "recommend";
    reason = `All ${matched.length} condition(s) match facts your connector established.`;
  } else {
    recommendation = "verify_first";
    reason = conditions.length
      ? `${matched.length} matched, ${needsVerification.length} still need verification before relying on this guide.`
      : "This guide declares no structured conditions; check its stated prerequisites yourself.";
  }
  return { matched, conflicts, needsVerification, recommendation, reason };
}
