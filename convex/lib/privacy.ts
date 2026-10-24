// Deterministic privacy scanner for buyer-facing text. It reduces identification risk;
// it does not guarantee anonymity. Raw matches are masked before being stored or shown.

export type PrivacyFinding = {
  id: string;
  kind: string;
  label: string;
  severity: "high" | "medium";
  field: string;
  excerpt: string;
  suggestion: string;
};

type Rule = {
  kind: string;
  label: string;
  severity: "high" | "medium";
  pattern: RegExp;
  replacement: string;
};

// Order matters: more specific rules first. Each match is consumed once.
const RULES: Rule[] = [
  {
    kind: "secret",
    label: "Credential or token-like string",
    severity: "high",
    pattern: /\b(?:AKIA[0-9A-Z]{16}|(?:sk|pk|nsk|rk)_(?:live|test)_[A-Za-z0-9]{8,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}|gh[pousr]_[A-Za-z0-9]{20,})\b/g,
    replacement: "[credential removed]",
  },
  {
    kind: "email",
    label: "Email address",
    severity: "high",
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    replacement: "[team contact]",
  },
  {
    kind: "ip_address",
    label: "IP address",
    severity: "high",
    pattern: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g,
    replacement: "[internal address]",
  },
  {
    kind: "hostname",
    label: "Internal hostname or domain",
    severity: "high",
    pattern: /\b(?:[a-z0-9-]+\.)+(?:internal|corp|local|lan|example|com|net|io|cloud)\b/gi,
    replacement: "[internal service]",
  },
  {
    kind: "customer_id",
    label: "Customer or account identifier",
    severity: "high",
    pattern: /\b(?:cust|acct|customer|tenant)[_-]?(?:id)?[_#: -]?\d{3,}\b/gi,
    replacement: "[customer account]",
  },
  {
    kind: "ticket_id",
    label: "Internal ticket reference",
    severity: "medium",
    pattern: /\b(?!(?:CVE|SHA|AES|TLS|RSA|ISO|NIST|SP|RFC|CWE)-)[A-Z]{2,6}-\d{2,6}\b/g,
    replacement: "[internal ticket]",
  },
  {
    kind: "timestamp",
    label: "Exact timestamp (can help identify the incident)",
    severity: "medium",
    pattern: /\b\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:?\d{2})?)?\b/g,
    replacement: "[date generalized]",
  },
];

export function maskExcerpt(match: string): string {
  if (match.length <= 4) return "•".repeat(match.length);
  const keep = Math.min(3, Math.floor(match.length / 4));
  return match.slice(0, keep) + "•".repeat(Math.max(3, match.length - keep * 2)) + match.slice(-keep);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Rules that depend on the contributor (their real organization name, known person names). */
function contextRules(identifyingTerms: string[]): Rule[] {
  return identifyingTerms
    .map((t) => t.trim())
    .filter((t) => t.length >= 3)
    .map((term) => ({
      kind: "org_or_person",
      label: "Organization or person name",
      severity: "high" as const,
      pattern: new RegExp(`\\b${escapeRegExp(term)}\\b`, "gi"),
      replacement: "[the organization]",
    }));
}

export type ScanInput = Record<string, string>;

/** Structured identifiers first (so a hostname containing the org name is reported once, as a hostname). */
function orderedRules(identifyingTerms: string[]): Rule[] {
  const structured = RULES.filter((r) => r.severity === "high");
  const loose = RULES.filter((r) => r.severity !== "high");
  return [...structured, ...contextRules(identifyingTerms), ...loose];
}

export function scanForPrivacyIssues(fields: ScanInput, identifyingTerms: string[] = []): PrivacyFinding[] {
  const rules = orderedRules(identifyingTerms);
  const findings: PrivacyFinding[] = [];
  for (const [field, text] of Object.entries(fields)) {
    let remaining = text;
    for (const rule of rules) {
      for (const m of remaining.matchAll(new RegExp(rule.pattern.source, rule.pattern.flags))) {
        findings.push({
          id: `${field}:${rule.kind}:${findings.length}`,
          kind: rule.kind,
          label: rule.label,
          severity: rule.severity,
          field,
          excerpt: maskExcerpt(m[0]),
          suggestion: `Replace with “${rule.replacement}”`,
        });
      }
      // Blank out consumed matches so later, broader rules don't double-report them.
      remaining = remaining.replace(new RegExp(rule.pattern.source, rule.pattern.flags), (s) => " ".repeat(s.length));
    }
  }
  return findings;
}

/** Apply every recommended generalization to the text. */
export function applyGeneralizations(text: string, identifyingTerms: string[] = []): string {
  let out = text;
  for (const rule of orderedRules(identifyingTerms)) {
    out = out.replace(new RegExp(rule.pattern.source, rule.pattern.flags), rule.replacement);
  }
  return out;
}

/** Stable, non-cryptographic content fingerprint used to tie approvals to an exact version. */
export function contentHash(parts: string[]): string {
  let h = 0x811c9dc5;
  const s = parts.join("␞");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0") + ":" + s.length.toString(16);
}
