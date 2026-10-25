// Shared by the local connector and the Convex backend (plain ESM, no Node built-ins).
// The canonical content hash ties contributor approval, server validation, and review to the
// exact same shareable bundle.

export const SCHEMA_VERSION = "1";

/** Content fields covered by the hash (order-independent). */
export const CONTENT_FIELDS = [
  "summary",
  "symptoms",
  "environmentCategories",
  "rootCauseEvidence",
  "unsuccessfulApproaches",
  "fixPattern",
  "verificationEvidence",
  "applicability",
  "limitations",
  "sourceKind",
  "sharingLicense",
  "priceAtomic",
];

export const LIMITS = { field: 2000, list: 12, listItem: 300 };

function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])]));
  return v;
}

export function canonicalBundle(bundle) {
  const out = {};
  for (const f of CONTENT_FIELDS) out[f] = bundle[f] ?? null;
  // Optional structured applicability conditions (shared/applicability.mjs). Hashed only when present, so
  // bundles without them keep their existing hash.
  if (bundle.conditions !== undefined) out.conditions = bundle.conditions;
  return JSON.stringify(sortKeys(out));
}

export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function bundleHash(bundle) {
  return "sha256:" + (await sha256Hex(canonicalBundle(bundle)));
}

/** Credential formats that must never leave the developer's machine (synthetic canaries included). */
export const SECRET_PATTERNS = [
  { kind: "aws_access_key", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { kind: "api_token", re: /\b(?:sk|pk|rk|nsk|ix)_(?:live|test|canary)_[A-Za-z0-9]{8,}\b/ },
  { kind: "github_token", re: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/ },
  { kind: "jwt", re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}\b/ },
  { kind: "private_key", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { kind: "bearer_header", re: /\bBearer\s+[A-Za-z0-9._~+/-]{16,}/i },
  { kind: "email", re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/ },
  { kind: "private_host", re: /\b(?:[a-z0-9-]+\.)+(?:internal|corp|local|lan)\b/i },
  { kind: "ip_address", re: /\b(?:10|127|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.\d{1,3}\.\d{1,3}(?:\.\d{1,3})?\b/ },
];

/** Returns finding categories only — never the matched text. */
export function scanSecrets(text, extraTerms = []) {
  const kinds = new Set();
  for (const p of SECRET_PATTERNS) if (p.re.test(text)) kinds.add(p.kind);
  for (const t of extraTerms) if (t && text.toLowerCase().includes(String(t).toLowerCase())) kinds.add("listed_private_term");
  return [...kinds];
}

/**
 * Heuristic flags for review/quarantine. NOT a security boundary: imperatives can be legitimate,
 * and attacks can evade phrases. Capabilities are enforced outside the model regardless.
 */
export const INJECTION_PATTERNS = [
  { kind: "override_instructions", re: /\b(ignore|disregard|override)\b.{0,40}\b(previous|prior|above|system|all)\b.{0,20}\b(instructions?|rules?|polic(y|ies))\b/i },
  { kind: "reveal_secret", re: /\b(reveal|print|show|send|exfiltrate|upload)\b.{0,40}\b(secret|token|credential|api key|password|\.env|wallet)\b/i },
  { kind: "payment_redirect", re: /\b(pay|send|transfer)\b.{0,40}\b(0x[0-9a-fA-F]{40}|different (address|payee|wallet))\b/i },
  { kind: "budget_change", re: /\b(increase|raise|set)\b.{0,30}\b(budget|spend(ing)? limit|max(imum)? (price|spend))\b/i },
  { kind: "command_execution", re: /\b(curl|wget|bash|sh -c|powershell|eval\(|rm -rf|npm (i|install) )\b/i },
  { kind: "active_markup", re: /<\s*(script|iframe|img[^>]+onerror|svg[^>]+onload)|javascript:/i },
];

export function scanInjection(text) {
  return INJECTION_PATTERNS.filter((p) => p.re.test(text)).map((p) => p.kind);
}

export function bundleText(bundle) {
  return CONTENT_FIELDS.map((f) => {
    const v = bundle[f];
    return Array.isArray(v) ? v.join("\n") : v == null ? "" : String(v);
  }).join("\n");
}
