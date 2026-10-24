// Host-side enforcement (outside any model): canonical paths, editable allowlist, symlink and
// traversal denial, denied file classes, and a local disclosure gate before network transmission.
import { lstatSync, readdirSync, realpathSync } from "node:fs";
import { join, relative, sep, isAbsolute } from "node:path";
import { scanSecrets, scanInjection } from "../../shared/bundle.mjs";

// Case-insensitive: macOS/Windows filesystems are case-insensitive, so `.GIT/` or `X.TEST.MJS` must not slip through.
const DENIED = [/(^|\/)\.env/i, /(^|\/)\.git(\/|$)/i, /(^|\/)\.ssh(\/|$)/i, /id_(rsa|ed25519)/i, /(^|\/)package(-lock)?\.json$/i, /(^|\/)\.github\//i, /\.test\.m?js$/i, /(^|\/)protected-tests(\/|$)/i, /wallet/i, /secret/i];

/** List files under dir (relative), refusing symlinks anywhere in the tree. */
export function listFiles(dir) {
  const out = [];
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      const st = lstatSync(p);
      if (st.isSymbolicLink()) throw new PolicyError(`symlink_denied`, `Symlink found in candidate workspace: ${relative(dir, p)}`);
      if (st.isDirectory()) walk(p);
      else out.push(relative(dir, p).split(sep).join("/"));
    }
  };
  walk(dir);
  return out.sort();
}

export class PolicyError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/** A candidate may only modify the editable allowlist; no new, deleted, symlinked, or denied files. */
export function enforceCandidate({ workspace, before, editable }) {
  const root = realpathSync(workspace);
  const after = listFiles(root);
  const added = after.filter((f) => !before.has(f));
  const removed = [...before.keys()].filter((f) => !after.includes(f));
  if (added.length || removed.length) throw new PolicyError("file_set_changed", `Candidate added/removed files: ${[...added, ...removed].join(", ")}`);
  const changed = after.filter((f) => before.get(f) !== readNorm(root, f));
  for (const f of changed) {
    if (isAbsolute(f) || f.includes("..")) throw new PolicyError("path_traversal", `Path escapes workspace: ${f}`);
    if (DENIED.some((re) => re.test(f))) throw new PolicyError("denied_path", `Write to a denied path: ${f}`);
    if (!editable.includes(f)) throw new PolicyError("not_editable", `Write outside the editable allowlist: ${f}`);
    checkCandidateContent(before.get(f) ?? "", readNorm(root, f), f);
  }
  return changed;
}

// Capabilities a repaired file must not gain. The protected runner also sandboxes execution
// (no fs-write/child-process; reads limited to the candidate dir), but Node has no network sandbox,
// so the content check is the line of defense for network and dynamic-code use.
const FORBIDDEN_CODE = [
  ["dynamic_code", /\beval\s*\(|\bnew\s+Function\b|(?<![\w.])Function\s*\(|\bimport\s*\(/],
  ["commonjs_require", /\brequire\s*\(|\bcreateRequire\b|\bmodule\.constructor\b/],
  ["process_access", /\bprocess\s*[.[]|\bglobalThis\s*[.[]\s*['"`]?process/],
  ["network", /\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|\bEventSource\b|\bnavigator\s*\./],
];
const importsOf = (src) => new Set([...src.matchAll(/\b(?:import|export)\b[^'"`;]*?\bfrom\s*['"`]([^'"`]+)['"`]|\bimport\s*['"`]([^'"`]+)['"`]/g)].map((m) => m[1] ?? m[2]));

/** Repaired code may only use modules the original already imported, and may not add dynamic code, process, or network access. */
// Comments are removed before scanning (JSDoc `import("./x").T` types are not code). Naive: a `//` inside a
// string is treated as a comment start, which can only hide code that is itself inside that string.
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:\\])\/\/.*$/gm, "$1");

export function checkCandidateContent(originalSrc, candidateSrc, file = "candidate") {
  const original = code(originalSrc);
  const candidate = code(candidateSrc);
  const allowed = importsOf(original);
  const added = [...importsOf(candidate)].filter((s) => !allowed.has(s));
  if (added.length) throw new PolicyError("new_import", `${file} adds imports not present in the original: ${added.join(", ")}`);
  for (const [kind, re] of FORBIDDEN_CODE) {
    if (re.test(candidate) && !re.test(original)) throw new PolicyError(kind, `${file} adds forbidden capability: ${kind.replace(/_/g, " ")}`);
  }
}

import { readFileSync } from "node:fs";
export function readNorm(root, f) {
  return readFileSync(join(root, f), "utf8");
}
export function snapshot(dir) {
  const root = realpathSync(dir);
  return new Map(listFiles(root).map((f) => [f, readNorm(root, f)]));
}

/** Only reads inside the selected project, after canonicalization; denied classes always refused. */
export function safeRead(projectRoot, rel) {
  const root = realpathSync(projectRoot);
  const target = realpathSync(join(root, rel));
  if (!target.startsWith(root + sep)) throw new PolicyError("path_traversal", "Read escapes the selected project.");
  const r = relative(root, target).split(sep).join("/");
  if (DENIED.some((re) => re.test(r))) throw new PolicyError("denied_path", `Read of a denied path refused: ${r}`);
  return readFileSync(target, "utf8");
}

const GENERALIZE = [
  [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[team contact]"],
  [/\b(?:[a-z0-9-]+\.)+(?:internal|corp|local|lan)\b/gi, "[internal host]"],
  [/\b(?:10|127|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.\d{1,3}\.\d{1,3}(?:\.\d{1,3})?\b/g, "[private address]"],
];
const CREDENTIAL_KINDS = new Set(["aws_access_key", "api_token", "github_token", "jwt", "private_key", "bearer_header"]);

/**
 * Local disclosure gate. Lines containing credential formats are dropped entirely; identifiers are
 * generalized; the result is rescanned and anything still flagged blocks staging. Returns categories
 * and counts only — never the matched text.
 */
export function stageField(value, privateTerms = []) {
  const report = { droppedCredentialLines: 0, generalized: 0, categories: new Set() };
  const clean = (text) =>
    text
      .split("\n")
      .filter((line) => {
        const kinds = scanSecrets(line).filter((k) => CREDENTIAL_KINDS.has(k));
        if (kinds.length) {
          report.droppedCredentialLines++;
          kinds.forEach((k) => report.categories.add(k));
          return false;
        }
        return true;
      })
      .map((line) => {
        let l = line;
        for (const [re, rep] of GENERALIZE) l = l.replace(re, () => (report.generalized++, rep));
        for (const t of privateTerms) {
          if (t && l.includes(t)) {
            report.generalized += l.split(t).length - 1;
            l = l.split(t).join("[private name]");
          }
        }
        return l;
      })
      .join("\n");
  const out = Array.isArray(value) ? value.map(clean).filter((x) => x.trim()) : clean(value);
  const residual = scanSecrets(Array.isArray(out) ? out.join("\n") : out, privateTerms);
  return { value: out, report: { ...report, categories: [...report.categories], residual } };
}

export { scanInjection };
