#!/usr/bin/env node
// Protected test runner: runs a sample repo's protected tests against a
// candidate source directory and returns a structured result.
import { spawn } from "node:child_process";
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const TIMEOUT_MS = 30_000;
const MAX_OUTPUT = 20 * 1024;

export function loadManifest() {
  return JSON.parse(readFileSync(join(ROOT, "manifest.json"), "utf8"));
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
  const repoDir = join(ROOT, repo);
  const cwd = join(repoDir, spec.protectedTests);
  const testFiles = spec.testFiles.map((f) => join(repoDir, f));
  for (const f of testFiles) if (!existsSync(f)) throw new Error(`Missing protected test file: ${f}`);

  const started = Date.now();
  const child = spawn(process.execPath, ["--test", "--test-reporter=tap", ...testFiles], {
    cwd,
    env: { PATH: process.env.PATH ?? "", CANDIDATE_DIR: candidate },
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
    ...parsed,
    exitCode,
    timedOut,
    durationMs: Date.now() - started,
    stdout: truncate(stdout),
    stderr: truncate(stderr),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const [repo, candidateDir] = process.argv.slice(2);
  if (!repo || !candidateDir) {
    console.error("usage: node sample-repos/run-protected-tests.mjs <repo> <candidateDir>");
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
