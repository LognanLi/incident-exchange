// Sandboxed candidate host. Runs in a SEPARATE Node process started by
// harness/remote.mjs with `--permission` and read-only access to the candidate
// directory and this harness directory (no fs-write, no child processes, no
// workers). Candidate code runs here and never in the assertion process.
//
// Protocol (structured-clone data only, over the IPC channel):
//   parent -> child  {type:"init", candidateFile, factory, argStyle, deps:{name:[methods]}}
//   child  -> parent {type:"ready"} | {type:"initError", message}
//   parent -> child  {type:"invoke", id, method, args}
//   child  -> parent {type:"result", id, ok:true, value} | {type:"result", id, ok:false, message}
//   child  -> parent {type:"dep", id, dep, method, args}
//   parent -> child  {type:"depResult", id, ok:true, value} | {type:"depResult", id, ok:false, message}
import { pathToFileURL } from "node:url";

const send = process.send.bind(process);
const pendingDeps = new Map();
let nextDepId = 1;
let instance = null;

function errMessage(err) {
  try {
    if (err && typeof err.message === "string") return err.message;
    return String(err);
  } catch {
    return "unserializable error";
  }
}

function safeSend(msg) {
  try {
    send(msg);
  } catch (err) {
    // Value was not cloneable: report as an error instead.
    if (msg && msg.type === "result") {
      send({ type: "result", id: msg.id, ok: false, message: `unserializable result: ${errMessage(err)}` });
    }
  }
}

function makeProxy(depName, methods) {
  const proxy = {};
  for (const method of methods) {
    proxy[method] = (...args) =>
      new Promise((resolve, reject) => {
        const id = nextDepId++;
        pendingDeps.set(id, { resolve, reject });
        try {
          send({ type: "dep", id, dep: depName, method, args });
        } catch (err) {
          pendingDeps.delete(id);
          reject(err);
        }
      });
  }
  return proxy;
}

async function init(msg) {
  try {
    const mod = await import(pathToFileURL(msg.candidateFile).href);
    const factory = mod[msg.factory];
    if (typeof factory !== "function") throw new Error(`candidate does not export function ${msg.factory}`);
    const proxies = {};
    for (const [name, methods] of Object.entries(msg.deps)) proxies[name] = makeProxy(name, methods);
    instance = msg.argStyle === "object" ? await factory(proxies) : await factory(...Object.values(proxies));
    if (!instance || typeof instance !== "object") throw new Error("factory did not return an object");
    send({ type: "ready" });
  } catch (err) {
    send({ type: "initError", message: errMessage(err) });
  }
}

async function invoke(msg) {
  try {
    const fn = instance && instance[msg.method];
    if (typeof fn !== "function") throw new Error(`candidate has no method ${msg.method}`);
    const value = await fn.apply(instance, msg.args);
    safeSend({ type: "result", id: msg.id, ok: true, value });
  } catch (err) {
    safeSend({ type: "result", id: msg.id, ok: false, message: errMessage(err) });
  }
}

process.on("message", (msg) => {
  if (!msg || typeof msg !== "object") return;
  if (msg.type === "init") init(msg);
  else if (msg.type === "invoke") invoke(msg);
  else if (msg.type === "depResult") {
    const p = pendingDeps.get(msg.id);
    if (!p) return;
    pendingDeps.delete(msg.id);
    if (msg.ok) p.resolve(msg.value);
    else p.reject(new Error(msg.message));
  }
});
process.on("disconnect", () => process.exit(0));
