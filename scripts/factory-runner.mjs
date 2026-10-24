// Local Factory Droid runner (v2). Listens on 127.0.0.1 only.
//
// Safety model (docs/BRIEF.md §7, Factory Droid):
// - Droid runs in a fresh temp directory containing ONLY handler.mjs, a copy of toy-apps/<case>/vulnerable.mjs.
// - Tools are restricted to Read, LS, ApplyPatch at autonomy "low": no shell, no network writes.
// - The prompt is fixed per case; nothing from the browser reaches Droid except IDs used for authorization
//   and a toyCase value validated against a fixed allowlist.
// - Afterwards the runner checks that no other file appeared, then runs the PROTECTED evaluator
//   (toy-apps/<case>/evaluate.mjs, outside the workspace) against the candidate in a child Node process
//   under the permission model (read-only access to the workspace and toy-apps, no child processes,
//   no writes), with a timeout. Results are recorded in Convex, which re-checks the role.
// - `node scripts/factory-runner.mjs --selftest <case>` exercises the evaluation path without Droid or Convex.
import http from "node:http";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
import { mintSession } from "../shared/session.mjs";
import { detectSandbox } from "../sample-repos/run-protected-tests.mjs";
import { MACOS_PROFILE } from "../sample-repos/harness/remote.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const TOY = join(ROOT, "toy-apps");
const PORT = Number(process.env.FACTORY_RUNNER_PORT ?? 3299);
const ALLOWED_ORIGINS = new Set(
  (process.env.IX_ALLOWED_ORIGINS ?? "http://localhost:5173,http://127.0.0.1:5173")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
);
const DROID = join(ROOT, "node_modules", ".bin", "droid");
const EDITABLE = "handler.mjs";
const PROMPT_TAIL =
  " Edit ONLY handler.mjs. Keep the exported API identical. Do not create other files. Reply in one sentence.";
const PROMPTS = {
  webhook:
    "You are applying a defensive fix to a fictional local demo webhook receiver in handler.mjs. " +
    "Provider retries currently enqueue duplicate jobs. Make handleDelivery idempotent by event id using the store's " +
    "atomic insertIfAbsent (do not use a separate has-then-insert check or in-memory state), so a repeated or concurrent " +
    "delivery of the same event enqueues exactly one job, while different events are still enqueued and every delivery " +
    "is still acknowledged with status 200.",
  tenant:
    "You are applying a defensive fix to a fictional local demo multi-tenant export service in handler.mjs. " +
    "getExport currently only checks that a session exists. Add tenant-scoped authorization: return 401 without a session, " +
    "return 404 without any data when the export belongs to a different tenant than session.tenantId, and keep returning " +
    "200 with the data for a user reading their own tenant's export.",
  keycache:
    "You are applying a defensive fix to a fictional local demo signed-event verifier in handler.mjs. " +
    "Keys are cached forever, so events signed with a rotated key are rejected. On an unknown kid, refresh the keys via " +
    "keySource.fetchKeys() at most once per options.minRefreshIntervalMs (use options.now()) and retry; still reject a kid " +
    "that is unknown after refreshing, and never skip or weaken signature verification.",
};
const CASE_IDS = Object.keys(PROMPTS);
const EVAL_TIMEOUT_MS = 20_000;

function readEnvFile(path) {
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
  );
}

const secrets = readEnvFile(join(ROOT, ".secrets.local"));
const local = readEnvFile(join(ROOT, ".env.local"));
const FACTORY_API_KEY = process.env.FACTORY_API_KEY ?? secrets.FACTORY_API_KEY;
const RUNNER_SECRET = process.env.FACTORY_RUNNER_SECRET ?? secrets.FACTORY_RUNNER_SECRET;
const CONVEX_URL = process.env.VITE_CONVEX_URL ?? local.VITE_CONVEX_URL;
const SESSION_SECRET = process.env.DEMO_SESSION_SECRET ?? secrets.DEMO_SESSION_SECRET;
const ready = Boolean(FACTORY_API_KEY && RUNNER_SECRET && CONVEX_URL && existsSync(DROID));
let busy = false;
let demoChild = null;

function runDroid(cwd, prompt) {
  return new Promise((resolvePromise) => {
    const child = spawn(DROID, ["exec", "--auto", "low", "--only-tools", "Read,LS,ApplyPatch", "--cwd", cwd, "-o", "json", prompt], {
      cwd,
      env: { PATH: process.env.PATH, HOME: process.env.HOME, FACTORY_API_KEY },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    const timer = setTimeout(() => child.kill("SIGKILL"), 180_000);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolvePromise({ code, out, err });
    });
  });
}

// Node 22 has a stable --permission flag; older 22.x/20.x only know --experimental-permission.
let permissionFlag = null;
async function getPermissionFlag() {
  if (permissionFlag) return permissionFlag;
  const works = (flag) =>
    new Promise((r) => {
      const c = spawn(process.execPath, [flag, "-e", "0"], { stdio: "ignore" });
      c.on("close", (code) => r(code === 0));
      c.on("error", () => r(false));
    });
  permissionFlag = (await works("--permission")) ? "--permission" : "--experimental-permission";
  return permissionFlag;
}

// Runs the protected evaluator for `toyCase` against `candidateFile` in a sandboxed child process.
async function runEvaluation(toyCase, workspace, candidateFile) {
  const flag = await getPermissionFlag();
  const toyReal = await realpath(TOY);
  const nonce = randomBytes(16).toString("hex");
  // One flag per directory with a trailing "/" so it grants that subtree only (comma lists did not work here).
  const args = [flag, `--allow-fs-read=${workspace}/`, `--allow-fs-read=${toyReal}/`, join(toyReal, "run-evaluation.mjs"), toyCase, candidateFile];
  // Factory's candidate is untrusted: it only runs inside an OS network sandbox (see sample-repos/run-protected-tests.mjs).
  const sandbox = detectSandbox();
  if (sandbox === "none") return { passed: false, summary: "No OS network sandbox available; refusing to execute candidate code.", assertions: [], lines: ["FAIL  Evaluator — no network sandbox on this machine"] };
  const [cmd, cmdArgs] = sandbox === "macos-sandbox-exec" ? ["/usr/bin/sandbox-exec", ["-p", MACOS_PROFILE, process.execPath, ...args]] : ["/usr/bin/unshare", ["--user", "--map-root-user", "--net", process.execPath, ...args]];
  const { code, out, timedOut } = await new Promise((r) => {
    const child = spawn(cmd, cmdArgs, { cwd: workspace, env: { PATH: process.env.PATH }, stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    let timedOut = false;
    child.stdout.on("data", (d) => {
      if (out.length < 200_000) out += d;
    });
    child.stderr.resume();
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, EVAL_TIMEOUT_MS);
    child.on("close", (code) => {
      clearTimeout(timer);
      r({ code, out, timedOut });
    });
    child.stdin.end(nonce + "\n");
  });
  const fail = (summary) => ({ passed: false, summary, assertions: [], lines: [`FAIL  Evaluator — ${summary}`] });
  if (timedOut) return fail(`evaluation timed out after ${EVAL_TIMEOUT_MS / 1000}s`);
  let result;
  try {
    result = JSON.parse(out.trim().split("\n").pop() ?? "");
  } catch {
    return fail(`evaluator produced no result (exit ${code})`);
  }
  if (code !== 0 || result?.nonce !== nonce) return fail(`evaluator result rejected (exit ${code})`);
  const assertions = Array.isArray(result.assertions) ? result.assertions : [];
  const clip = (s) => (s.length > 200 ? s.slice(0, 197) + "..." : s);
  const lines = assertions
    .slice(0, 20)
    .map((a) => clip(a.ok === true ? `PASS  ${String(a.name)}` : `FAIL  ${String(a.name)} — ${String(a.detail)}`));
  return { passed: result.passed === true && assertions.length > 0 && assertions.every((a) => a.ok === true), summary: String(result.summary), assertions, lines };
}

// Minimal LCS line diff with 2 lines of context, unified-style. No dependencies.
export function lineDiff(a, b, name = EDITABLE) {
  const A = a.split("\n");
  const B = b.split("\n");
  if (A.length * B.length > 4_000_000) return `--- a/${name}\n+++ b/${name}\n@@ file too large to diff @@`;
  const dp = Array.from({ length: A.length + 1 }, () => new Uint32Array(B.length + 1));
  for (let i = A.length - 1; i >= 0; i--)
    for (let j = B.length - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ops = [];
  let i = 0;
  let j = 0;
  while (i < A.length || j < B.length) {
    if (i < A.length && j < B.length && A[i] === B[j]) ops.push([" ", A[i++], j++]);
    else if (i < A.length && (j >= B.length || dp[i + 1][j] >= dp[i][j + 1])) ops.push(["-", A[i++]]);
    else ops.push(["+", B[j++]]);
  }
  const keep = ops.map(() => false);
  ops.forEach((op, k) => {
    if (op[0] !== " ") for (let d = -2; d <= 2; d++) if (ops[k + d]) keep[k + d] = true;
  });
  const out = [`--- a/${name}`, `+++ b/${name}`];
  let gap = true;
  ops.forEach((op, k) => {
    if (!keep[k]) return void (gap = true);
    if (gap) out.push("@@");
    gap = false;
    out.push(`${op[0]} ${op[1]}`);
  });
  if (out.length === 2) return "";
  const text = out.join("\n");
  return text.length > 20_000 ? text.slice(0, 20_000) + "\n... (diff truncated)" : text;
}

async function makeWorkspace(toyCase) {
  const dir = await realpath(await mkdtemp(join(tmpdir(), "ix-factory-")));
  const vulnerablePath = join(TOY, toyCase, "vulnerable.mjs");
  await copyFile(vulnerablePath, join(dir, EDITABLE));
  return { dir, vulnerablePath, original: await readFile(vulnerablePath, "utf8") };
}

async function patch({ actor, draftId, toyCase }) {
  const convex = new ConvexHttpClient(CONVEX_URL);
  // Authorizes the actor as a reviewer (server-side); throws otherwise.
  await convex.query(anyApi.validation.panel, { actor, draftId });

  let dir;
  try {
    const ws = await makeWorkspace(toyCase);
    dir = ws.dir;
    const startedAt = new Date().toISOString();
    // Baseline: the protected evaluator against the original vulnerable file (expected to fail).
    const baseline = await runEvaluation(toyCase, dir, join(dir, EDITABLE));

    const droidStart = Date.now();
    const { code, out, err } = await runDroid(dir, PROMPTS[toyCase] + PROMPT_TAIL);
    const droidDurationMs = Date.now() - droidStart;
    const line = out.trim().split("\n").filter(Boolean).pop() ?? "{}";
    let result;
    try {
      result = JSON.parse(line);
    } catch {
      result = {};
    }
    if (code !== 0 || result.is_error) throw new Error(`droid exec failed (exit ${code}): ${String(result.result ?? err).slice(0, 200)}`);

    const files = await readdir(dir);
    if (files.length !== 1 || files[0] !== EDITABLE) throw new Error(`Droid changed files outside the allowlist: ${files.join(", ")}`);
    const candidate = await readFile(join(dir, EDITABLE), "utf8");
    const diff = lineDiff(ws.original, candidate);
    const changedFiles = diff ? [EDITABLE] : [];

    const after = await runEvaluation(toyCase, dir, join(dir, EDITABLE));
    const droidSummary = String(result.result ?? "").slice(0, 1000);
    const sessionId = String(result.session_id ?? "");

    await convex.mutation(anyApi.validation.recordFactoryRun, {
      actor,
      draftId,
      runnerSecret: RUNNER_SECRET,
      toyCase,
      baseline: { passed: baseline.passed, lines: baseline.lines },
      after: { passed: after.passed, lines: after.lines },
      diff,
      changedFiles,
      droidSummary,
      sessionId,
    });

    const finishedAt = new Date().toISOString();
    const artifactDir = join(TOY, "artifacts");
    await mkdir(artifactDir, { recursive: true });
    const artifactName = `${toyCase}-${finishedAt.replace(/[:.]/g, "-")}.json`;
    const artifact = {
      toyCase,
      startedAt,
      finishedAt,
      baseline,
      after,
      diff,
      changedFiles,
      droid: { sessionId, summary: droidSummary, durationMs: droidDurationMs, reportedDurationMs: result.duration_ms ?? null },
    };
    await writeFile(join(artifactDir, artifactName), JSON.stringify(artifact, null, 2) + "\n");
    return {
      ok: true,
      summary: droidSummary,
      baselinePassed: baseline.passed,
      afterPassed: after.passed,
      artifact: `toy-apps/artifacts/${artifactName}`,
    };
  } catch (e) {
    await convex.mutation(anyApi.validation.recordFactoryFailure, { runnerSecret: RUNNER_SECRET, message: e.message }).catch(() => {});
    throw e;
  } finally {
    if (dir) await rm(dir, { recursive: true, force: true });
  }
}

// --selftest <case>: vulnerable must fail, fixed must pass, through the same sandboxed evaluation path.
async function selftest(toyCase) {
  if (!CASE_IDS.includes(toyCase)) throw new Error(`Unknown case. Use one of: ${CASE_IDS.join(", ")}`);
  const ws = await makeWorkspace(toyCase);
  try {
    const candidatePath = join(ws.dir, EDITABLE);
    const before = await runEvaluation(toyCase, ws.dir, candidatePath);
    console.log(`[${toyCase}] baseline (vulnerable): ${before.passed ? "PASS" : "FAIL"} — ${before.summary}`);
    before.lines.forEach((l) => console.log("   " + l));
    const fixed = await readFile(join(TOY, toyCase, "fixed.mjs"), "utf8");
    await writeFile(candidatePath, fixed);
    const after = await runEvaluation(toyCase, ws.dir, candidatePath);
    console.log(`[${toyCase}] after (fixed): ${after.passed ? "PASS" : "FAIL"} — ${after.summary}`);
    after.lines.forEach((l) => console.log("   " + l));
    console.log(lineDiff(ws.original, fixed));
    const ok = !before.passed && after.passed;
    console.log(`[${toyCase}] selftest ${ok ? "OK" : "FAILED"}`);
    return ok;
  } finally {
    await rm(ws.dir, { recursive: true, force: true });
  }
}

if (process.argv[2] === "--selftest") {
  const ok = await selftest(process.argv[3]).catch((e) => (console.error(e.message), false));
  process.exit(ok ? 0 : 1);
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  }
  const send = (status, body) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };
  if (req.method === "OPTIONS") return send(204, {});
  if (origin && !ALLOWED_ORIGINS.has(origin)) return send(403, { error: "Origin not allowed" });

  if (req.method === "GET" && req.url === "/health") return send(200, { ready, busy, demoRunning: !!demoChild });
  // State-changing endpoints are browser-only presenter controls: require an allowed Origin (blocks curl/other local processes
  // that don't spoof headers, and cross-site pages via CORS).
  if (req.method === "POST" && !origin) return send(403, { error: "Origin required" });
  if (req.method === "POST" && req.url === "/session") {
    // Mints signed demo sessions (the demo's stand-in for sign-in) for existing seeded orgs only.
    if (!SESSION_SECRET || !CONVEX_URL) return send(503, { error: "DEMO_SESSION_SECRET is not configured. Run `npm run agents:setup`." });
    let raw = "";
    for await (const chunk of req) { raw += chunk; if (raw.length > 2000) return send(413, { error: "Request too large" }); }
    let body; try { body = JSON.parse(raw || "{}"); } catch { return send(400, { error: "Invalid JSON" }); }
    if (!Array.isArray(body.slugs) || body.slugs.length > 20) return send(400, { error: "slugs required" });
    const orgs = await new ConvexHttpClient(CONVEX_URL).query(anyApi.demo.listOrgs, {}).catch(() => []);
    const known = new Set(orgs.map((o) => o.slug));
    const tokens = {};
    for (const slug of body.slugs) if (typeof slug === "string" && known.has(slug)) tokens[slug] = await mintSession(SESSION_SECRET, slug);
    return send(200, { tokens });
  }
  if (req.method === "POST" && req.url === "/agent-demo") {
    // Presenter control: start the real two-agent demo (connector/demo.mjs). One at a time; fixed script, no arguments from the browser.
    let raw = "";
    for await (const chunk of req) { raw += chunk; if (raw.length > 500) return send(413, { error: "Request too large" }); }
    let body; try { body = JSON.parse(raw || "{}"); } catch { return send(400, { error: "Invalid JSON" }); }
    if (typeof body.actor !== "string") return send(400, { error: "actor required" });
    if (demoChild) return send(409, { error: "A demo run is already in progress." });
    const convex = new ConvexHttpClient(CONVEX_URL);
    const ok = await convex.query(anyApi.agentsConsole.canRunDemo, { actor: body.actor }).catch(() => ({ ok: false }));
    if (!ok.ok) return send(403, { error: "Switch to the Review Desk role to run the agent demo, or wait for the current run to finish." });
    demoChild = spawn(process.execPath, [join(ROOT, "connector", "demo.mjs"), ...(body.simulatePayment === true ? ["--simulate-payment"] : [])], { cwd: ROOT, stdio: "ignore", env: { PATH: process.env.PATH, HOME: process.env.HOME } });
    demoChild.on("close", () => { demoChild = null; });
    return send(202, { started: true });
  }
  if (req.method === "POST" && req.url === "/patch") {
    if (!ready) return send(503, { error: "Factory runner is not configured." });
    if (busy) return send(409, { error: "A Factory run is already in progress." });
    let raw = "";
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > 2000) return send(413, { error: "Request too large" });
    }
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return send(400, { error: "Invalid JSON" });
    }
    if (typeof body?.actor !== "string" || typeof body?.draftId !== "string") return send(400, { error: "actor and draftId are required" });
    if (typeof body.toyCase !== "string" || !CASE_IDS.includes(body.toyCase)) return send(400, { error: `toyCase must be one of: ${CASE_IDS.join(", ")}` });
    busy = true;
    try {
      return send(200, await patch({ actor: body.actor, draftId: body.draftId, toyCase: body.toyCase }));
    } catch (e) {
      return send(500, { error: e.message });
    } finally {
      busy = false;
    }
  }
  send(404, { error: "Not found" });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Factory runner on http://127.0.0.1:${PORT} — ${ready ? "ready" : "not configured (local demo adapter will be used)"}`);
});
