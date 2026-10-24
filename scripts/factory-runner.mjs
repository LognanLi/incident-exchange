// Local Factory Droid runner. Listens on 127.0.0.1 only.
//
// Safety model (docs/BRIEF.md §7, Factory Droid):
// - Droid runs in a fresh temp directory containing ONLY a copy of the toy target's config.
// - Tools are restricted to Read, LS, ApplyPatch at autonomy "low": no shell, no network writes.
// - The prompt is fixed; nothing from the browser reaches Droid except IDs used for authorization.
// - Afterwards the runner checks that no other file appeared and that the config is valid JSON of the
//   exact expected shape, then records the result in Convex (which re-checks role + ranges).
import http from "node:http";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";

const ROOT = resolve(import.meta.dirname, "..");
const PORT = Number(process.env.FACTORY_RUNNER_PORT ?? 3299);
const ALLOWED_ORIGINS = new Set(["http://localhost:5173", "http://127.0.0.1:5173"]);
const DROID = join(ROOT, "node_modules", ".bin", "droid");
const PROMPT =
  "You are applying a defensive fix to a deliberately misconfigured local demo login service. " +
  "Edit ONLY auth-config.json in the current directory so failed-attempt lockout and alerting are enabled: " +
  "set maxFailedAttempts to 5, keep lockoutWindowSeconds at 900, set alertOnRepeatedFailures to true. " +
  "Keep valid JSON with exactly these three keys. Do not create, rename, or delete any file. Reply with one sentence.";

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
const ready = Boolean(FACTORY_API_KEY && RUNNER_SECRET && CONVEX_URL && existsSync(DROID));
let busy = false;

function runDroid(cwd) {
  return new Promise((resolvePromise) => {
    const child = spawn(DROID, ["exec", "--auto", "low", "--only-tools", "Read,LS,ApplyPatch", "--cwd", cwd, "-o", "json", PROMPT], {
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

function validConfig(c) {
  const keys = Object.keys(c ?? {}).sort().join(",");
  return (
    keys === "alertOnRepeatedFailures,lockoutWindowSeconds,maxFailedAttempts" &&
    Number.isInteger(c.maxFailedAttempts) &&
    Number.isInteger(c.lockoutWindowSeconds) &&
    typeof c.alertOnRepeatedFailures === "boolean"
  );
}

async function patch({ actor, draftId }) {
  const convex = new ConvexHttpClient(CONVEX_URL);
  // Authorizes the actor as a reviewer (server-side) and returns the current target config.
  const panel = await convex.query(anyApi.validation.panel, { actor, draftId });
  if (!panel.target?.authorized) throw new Error("Target is not an authorized local demo target.");

  const dir = await mkdtemp(join(tmpdir(), "ix-factory-"));
  try {
    await writeFile(join(dir, "auth-config.json"), JSON.stringify(panel.target.config, null, 2) + "\n");
    const { code, out, err } = await runDroid(dir);
    const line = out.trim().split("\n").filter(Boolean).pop() ?? "{}";
    let result;
    try {
      result = JSON.parse(line);
    } catch {
      result = {};
    }
    if (code !== 0 || result.is_error) throw new Error(`droid exec failed (exit ${code}): ${(result.result ?? err).slice(0, 200)}`);

    const files = await readdir(dir);
    if (files.length !== 1 || files[0] !== "auth-config.json") throw new Error(`Droid changed files outside the allowlist: ${files.join(", ")}`);
    let config;
    try {
      config = JSON.parse(await readFile(join(dir, "auth-config.json"), "utf8"));
    } catch {
      throw new Error("Droid left auth-config.json as invalid JSON.");
    }
    if (!validConfig(config)) throw new Error("Droid's config does not have the expected shape.");

    await convex.mutation(anyApi.validation.recordFactoryFix, {
      actor,
      draftId,
      runnerSecret: RUNNER_SECRET,
      config,
      droidSummary: String(result.result ?? ""),
      sessionId: String(result.session_id ?? ""),
    });
    return { ok: true, summary: String(result.result ?? ""), durationMs: result.duration_ms };
  } catch (e) {
    await convex.mutation(anyApi.validation.recordFactoryFailure, { runnerSecret: RUNNER_SECRET, message: e.message }).catch(() => {});
    throw e;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
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

  if (req.method === "GET" && req.url === "/health") return send(200, { ready, busy });
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
    if (typeof body.actor !== "string" || typeof body.draftId !== "string") return send(400, { error: "actor and draftId are required" });
    busy = true;
    try {
      return send(200, await patch(body));
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
