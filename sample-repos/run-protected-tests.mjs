#!/usr/bin/env node
// Protected test runner: runs a sample repo's protected tests against a
// candidate source directory and returns a structured result.
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { MACOS_PROFILE } from "./harness/remote.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const TIMEOUT_MS = 30_000;
const MAX_OUTPUT = 20 * 1024;

export function loadManifest() {
  return JSON.parse(readFileSync(join(ROOT, "manifest.json"), "utf8"));
}

function listFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) listFiles(full, out);
    else if (entry.isFile()) out.push(full);
    else throw new Error(`Unexpected non-regular file in protected suite: ${full}`);
  }
  return out;
}

// sha256 over the sorted (relative path, contents) pairs of the repo's
// protected-tests/ directory and the shared harness/ directory.
export function computeSuiteHash(repo) {
  const manifest = loadManifest();
  if (!Object.prototype.hasOwnProperty.call(manifest, repo)) throw new Error(`Unknown repo "${repo}"`);
  const dirs = [join(ROOT, repo, manifest[repo].protectedTests), join(ROOT, "harness")];
  const files = dirs
    .flatMap((d) => listFiles(d))
    .map((f) => ({ rel: relative(ROOT, f).split(sep).join("/"), full: f }))
    .sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
  const h = createHash("sha256");
  for (const { rel, full } of files) {
    const data = readFileSync(full);
    h.update(`${rel}\0${data.length}\0`);
    h.update(data);
    h.update("\0");
  }
  return h.digest("hex");
}

function findTampering(dir, depth = 0) {
  if (depth > 8) return null;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "protected-tests") return full;
      const hit = findTampering(full, depth + 1);
      if (hit) return hit;
    } else if (entry.name.endsWith(".test.mjs")) {
      return full;
    }
  }
  return null;
}

export function parseTap(stdout) {
  const tests = [];
  for (const line of stdout.split(/\r?\n/)) {
    // Top-level test points only (subtests are indented).
    const m = /^(not )?ok \d+(?: - (.*?))?(?: # .*)?$/.exec(line);
    if (m) tests.push({ name: (m[2] ?? "").trim(), ok: !m[1] });
  }
  const passedCount = tests.filter((t) => t.ok).length;
  return { tests, total: tests.length, passedCount, failedCount: tests.length - passedCount };
}

const truncate = (s) => (s.length > MAX_OUTPUT ? s.slice(0, MAX_OUTPUT) + "\n...[truncated]" : s);

let sandboxCache;
/** Probe for an OS-level sandbox that blocks network access for the candidate process. */
export function detectSandbox() {
  if (sandboxCache) return sandboxCache;
  const probe = (cmd, args) => spawnSync(cmd, args, { stdio: "ignore", timeout: 5000 }).status === 0;
  const netBlocked = (cmd, args) =>
    // The probe must succeed at running node but FAIL to open a TCP connection.
    probe(cmd, [...args, process.execPath, "-e", "require('net').connect(80,'1.1.1.1').on('error',()=>process.exit(0)).on('connect',()=>process.exit(3));setTimeout(()=>process.exit(4),3000)"]);
  if (process.platform === "darwin" && existsSync("/usr/bin/sandbox-exec") && netBlocked("/usr/bin/sandbox-exec", ["-p", MACOS_PROFILE])) sandboxCache = "macos-sandbox-exec";
  else if (process.platform === "linux" && existsSync("/usr/bin/unshare") && netBlocked("/usr/bin/unshare", ["--user", "--map-root-user", "--net"])) sandboxCache = "linux-unshare";
  else sandboxCache = "none";
  return sandboxCache;
}
function isTrustedFixture(dir) {
  const real = realpathSync(dir);
  return real.startsWith(realpathSync(ROOT) + sep) && !real.includes(`${sep}node_modules${sep}`);
}

export async function runProtectedTests({ repo, candidateDir }) {
  const manifest = loadManifest();
  if (typeof repo !== "string" || !Object.prototype.hasOwnProperty.call(manifest, repo)) {
    throw new Error(`Unknown repo "${repo}". Expected one of: ${Object.keys(manifest).join(", ")}`);
  }
  if (typeof candidateDir !== "string" || !candidateDir) throw new Error("candidateDir is required");
  const candidate = realpathSync(resolve(candidateDir));
  if (!statSync(candidate).isDirectory()) throw new Error(`candidateDir is not a directory: ${candidate}`);
  const tampered = findTampering(candidate);
  if (tampered) throw new Error(`Tampering guard: candidate dir contains test material: ${tampered}`);

  const spec = manifest[repo];
  const pinned = spec.protectedSuiteSha256;
  if (typeof pinned !== "string" || !/^[0-9a-f]{64}$/.test(pinned)) {
    throw new Error(`Protected suite for ${repo} has no pinned protectedSuiteSha256 in manifest.json`);
  }
  const actual = computeSuiteHash(repo);
  if (actual !== pinned) {
    throw new Error(`Protected suite hash mismatch for ${repo}: expected ${pinned}, got ${actual}. Refusing to run.`);
  }
  const repoDir = join(ROOT, repo);
  const cwd = join(repoDir, spec.protectedTests);
  const testFiles = spec.testFiles.map((f) => join(repoDir, f));
  for (const f of testFiles) if (!existsSync(f)) throw new Error(`Missing protected test file: ${f}`);

  // Candidate code only runs inside an OS network sandbox. Without one, only committed fixtures
  // inside sample-repos/ (trusted code we wrote) may run; arbitrary patches are refused.
  let sandbox = detectSandbox();
  if (sandbox === "none") {
    if (!isTrustedFixture(candidate)) {
      throw new Error("No OS network sandbox is available on this machine (macOS sandbox-exec or Linux unshare). Refusing to execute untrusted candidate code; only committed fixtures under sample-repos/ can run here.");
    }
    sandbox = "none-trusted-fixture";
  }
  const started = Date.now();
  const child = spawn(process.execPath, ["--test", "--test-reporter=tap", ...testFiles], {
    cwd,
    env: { PATH: process.env.PATH ?? "", CANDIDATE_DIR: candidate, IX_SANDBOX: sandbox },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (d) => { if (stdout.length < MAX_OUTPUT * 2) stdout += d; });
  child.stderr.on("data", (d) => { if (stderr.length < MAX_OUTPUT * 2) stderr += d; });
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, TIMEOUT_MS);
  const exitCode = await new Promise((res) => {
    child.on("close", (code) => res(code));
    child.on("error", () => res(-1));
  });
  clearTimeout(timer);

  const parsed = parseTap(stdout);
  return {
    repo,
    candidateDir: candidate,
    passed: !timedOut && exitCode === 0 && parsed.total > 0 && parsed.failedCount === 0,
    sandbox,
    ...parsed,
    exitCode,
    timedOut,
    durationMs: Date.now() - started,
    stdout: truncate(stdout),
    stderr: truncate(stderr),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  if (process.argv[2] === "--print-suite-hashes") {
    const hashes = Object.fromEntries(Object.keys(loadManifest()).map((r) => [r, computeSuiteHash(r)]));
    console.log(JSON.stringify(hashes, null, 2));
    process.exit(0);
  }
  const [repo, candidateDir] = process.argv.slice(2);
  if (!repo || !candidateDir) {
    console.error("usage: node sample-repos/run-protected-tests.mjs <repo> <candidateDir>\n       node sample-repos/run-protected-tests.mjs --print-suite-hashes");
    process.exit(2);
  }
  try {
    const result = await runProtectedTests({ repo, candidateDir });
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.passed ? 0 : 1);
  } catch (err) {
    console.log(JSON.stringify({ passed: false, error: err.message }, null, 2));
    process.exit(2);
  }
}
