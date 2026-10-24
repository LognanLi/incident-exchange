// Parent-side harness (runs in the protected test process). Spawns the
// candidate in a permission-restricted child process (harness/child.mjs) and
// services its dependency calls against implementations that live ONLY here,
// so assertions always read trusted state. Nothing received from the child is
// ever evaluated; it is treated as plain data.
import { fork } from "node:child_process";
import { realpathSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";

const HARNESS_DIR = realpathSync(dirname(fileURLToPath(import.meta.url)));
const CHILD = join(HARNESS_DIR, "child.mjs");
const CALL_TIMEOUT_MS = 5_000;
const MAX_STDERR = 8 * 1024;

const withSlash = (p) => (p.endsWith(sep) ? p : p + sep);

// OS-level network sandbox, chosen by run-protected-tests.mjs (IX_SANDBOX). Node's --permission model
// restricts fs/child-process but has no network control, so the network block must come from the OS.
// macOS: sandbox-exec profile denies all network and all file writes (except /dev for stdio).
export const MACOS_PROFILE = '(version 1)(allow default)(deny network*)(deny file-write* (require-not (subpath "/dev")))';
function launcher() {
  const mode = process.env.IX_SANDBOX;
  if (mode === "macos-sandbox-exec") return { execPath: "/usr/bin/sandbox-exec", prefix: ["-p", MACOS_PROFILE, process.execPath] };
  if (mode === "linux-unshare") return { execPath: "/usr/bin/unshare", prefix: ["--user", "--map-root-user", "--net", process.execPath] };
  if (mode === "none-trusted-fixture") return { execPath: process.execPath, prefix: [] };
  throw new Error("No network sandbox selected for candidate execution (IX_SANDBOX unset); refusing to run candidate code.");
}

/**
 * @param {{ candidateFile: string, candidateDir?: string, factory: string,
 *           argStyle: "positional"|"object", deps: Record<string, object> }} opts
 * @returns {{ call(method: string, ...args: unknown[]): Promise<unknown>, close(): void }}
 */
export function spawnCandidate({ candidateFile, candidateDir, factory, argStyle, deps }) {
  const file = realpathSync(candidateFile);
  const dir = realpathSync(candidateDir ?? dirname(file));
  if (!file.startsWith(withSlash(dir))) throw new Error("candidateFile must be inside candidateDir");
  if (argStyle !== "positional" && argStyle !== "object") throw new Error("bad argStyle");

  // Only own, function-valued methods of each dependency are exposed.
  const depMethods = {};
  for (const [name, impl] of Object.entries(deps)) {
    depMethods[name] = Object.keys(impl).filter((k) => typeof impl[k] === "function");
  }

  const { execPath, prefix } = launcher();
  const child = fork(CHILD, [], {
    execPath,
    execArgv: [
      ...prefix,
      "--permission",
      `--allow-fs-read=${withSlash(dir)}`,
      `--allow-fs-read=${withSlash(HARNESS_DIR)}`,
    ],
    env: {},
    cwd: dir,
    stdio: ["ignore", "ignore", "pipe", "ipc"],
    serialization: "advanced",
  });

  let stderr = "";
  child.stderr.on("data", (d) => { if (stderr.length < MAX_STDERR) stderr += d; });

  let closed = false;
  let deathReason = null;
  const pending = new Map();
  let nextId = 1;
  let readyResolve, readyReject;
  const ready = new Promise((res, rej) => { readyResolve = res; readyReject = rej; });
  ready.catch(() => {});

  function fail(reason) {
    if (deathReason) return;
    deathReason = reason;
    readyReject(new Error(reason));
    for (const p of pending.values()) { clearTimeout(p.timer); p.reject(new Error(reason)); }
    pending.clear();
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
  }

  const initTimer = setTimeout(() => fail("candidate init timed out"), CALL_TIMEOUT_MS);

  child.on("exit", (code, signal) => {
    clearTimeout(initTimer);
    const tail = stderr.trim().split("\n").slice(-5).join("\n");
    fail(closed ? "candidate closed" : `candidate process exited (code=${code}, signal=${signal})${tail ? `: ${tail}` : ""}`);
  });
  child.on("error", (err) => fail(`candidate process error: ${err.message}`));

  child.on("message", async (msg) => {
    if (!msg || typeof msg !== "object") return;
    switch (msg.type) {
      case "ready":
        clearTimeout(initTimer);
        readyResolve();
        break;
      case "initError":
        clearTimeout(initTimer);
        fail(`candidate failed to initialize: ${String(msg.message)}`);
        break;
      case "result": {
        const p = pending.get(msg.id);
        if (!p) return;
        pending.delete(msg.id);
        clearTimeout(p.timer);
        if (msg.ok === true) p.resolve(msg.value);
        else p.reject(new Error(String(msg.message)));
        break;
      }
      case "dep": {
        const { id, dep, method } = msg;
        const reply = (m) => { if (!deathReason && child.connected) { try { child.send({ type: "depResult", id, ...m }); } catch {} } };
        try {
          if (typeof dep !== "string" || !Object.hasOwn(depMethods, dep) || !depMethods[dep].includes(method)) {
            throw new Error(`unknown dependency method ${String(dep)}.${String(method)}`);
          }
          const args = Array.isArray(msg.args) ? msg.args : [];
          const value = await deps[dep][method](...args);
          reply({ ok: true, value });
        } catch (err) {
          reply({ ok: false, message: err && typeof err.message === "string" ? err.message : String(err) });
        }
        break;
      }
      default:
        break;
    }
  });

  child.send({ type: "init", candidateFile: file, factory, argStyle, deps: depMethods });

  return {
    async call(method, ...args) {
      await ready;
      if (deathReason) throw new Error(deathReason);
      return new Promise((resolve, reject) => {
        const id = nextId++;
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`call ${method} timed out after ${CALL_TIMEOUT_MS}ms`));
          fail("candidate call timed out");
        }, CALL_TIMEOUT_MS);
        pending.set(id, { resolve, reject, timer });
        try {
          child.send({ type: "invoke", id, method, args });
        } catch (err) {
          pending.delete(id);
          clearTimeout(timer);
          reject(err);
        }
      });
    },
    close() {
      closed = true;
      clearTimeout(initTimer);
      fail("candidate closed");
    },
  };
}
