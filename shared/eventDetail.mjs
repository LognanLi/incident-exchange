// Technical details attached to agent activity events (MCP tool, sanitized inputs, result, revision, evidence).
// Plain ESM shared by the connectors (pre-sanitize before sending) and Convex (authoritative sanitization
// before storage). Details are display evidence only; nothing reads them to make decisions.
import { scanSecrets } from "./bundle.mjs";

export const DETAIL_LIMITS = { entries: 10, key: 40, value: 240, result: 300 };

/** Keys that must never be stored, whatever their value (credentials, signatures, raw authorizations). */
const FORBIDDEN_KEY = /token|secret|password|passphrase|authorization|bearer|signature|signed|private|cookie|nonce|api[_ -]?key|credential|mnemonic|seed/i;

export const sanitizeEventText = (s, max = 240) => {
  // Scan the entire value BEFORE truncating: cutting a credential can hide its recognizable format.
  const text = String(s ?? "").replace(/\s+/g, " ").trim();
  const kinds = scanSecrets(text);
  if (/\b(?:ixa_|ixat_)[A-Za-z0-9_-]+|\bixs2\.[A-Za-z0-9_.-]+|\b0x[0-9a-f]{65,}\b|\b(?:password|secret|api[_ -]?key|authorization|bearer|mnemonic|seed phrase)\s*[:=]\s*\S+/i.test(text)) kinds.push("credential");
  return kinds.length ? `[redacted: ${[...new Set(kinds)].join(", ")}]` : text.slice(0, max);
};

function entries(list) {
  if (!Array.isArray(list)) return undefined;
  const out = [];
  for (const e of list) {
    if (!e || typeof e.k !== "string" || e.v === undefined || e.v === null) continue;
    if (FORBIDDEN_KEY.test(e.k)) continue;
    const k = sanitizeEventText(e.k, DETAIL_LIMITS.key);
    if (!/^[A-Za-z][\w .()/-]*$/.test(k) || FORBIDDEN_KEY.test(k)) continue;
    out.push({ k, v: sanitizeEventText(e.v, DETAIL_LIMITS.value) });
    if (out.length >= DETAIL_LIMITS.entries) break;
  }
  return out.length ? out : undefined;
}

/**
 * @param {{ tool?: string, input?: {k: string, v: unknown}[], result?: string, resolutionId?: string, revision?: number, evidence?: {k: string, v: unknown}[] } | undefined} d
 * @returns {{ tool?: string, input?: {k: string, v: string}[], result?: string, resolutionId?: string, revision?: number, evidence?: {k: string, v: string}[] } | undefined}
 */
export function sanitizeEventDetail(d) {
  if (!d || typeof d !== "object") return undefined;
  const out = {};
  if (typeof d.tool === "string" && /^[a-z][a-z0-9_ -]{1,40}$/i.test(d.tool)) out.tool = d.tool;
  const input = entries(d.input);
  if (input) out.input = input;
  if (d.result !== undefined && d.result !== null) out.result = sanitizeEventText(d.result, DETAIL_LIMITS.result);
  if (typeof d.resolutionId === "string" && /^[a-z0-9]{10,40}$/.test(d.resolutionId)) out.resolutionId = d.resolutionId;
  if (Number.isInteger(d.revision) && d.revision > 0 && d.revision < 1e6) out.revision = d.revision;
  const evidence = entries(d.evidence);
  if (evidence) out.evidence = evidence;
  return Object.keys(out).length ? out : undefined;
}
