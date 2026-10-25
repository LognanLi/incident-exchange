"use node";
// Semantic search over the shared Moss index of public previews. Used by buyer web search and MCP search.
// Moss failures never block search: results fall back to keyword clue matching, labeled with the reason.
import { v } from "convex/values";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { SearchResults } from "./playbooks";
import { MossClient } from "@moss-js/moss";
import { action, internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { mossCredentials } from "./lib/moss";
import { MIN_SEMANTIC_SCORE, PUBLIC_INDEX_NAME, SEMANTIC_TOP_K, sameDocs, type SemanticCandidate, type SearchEngine } from "./lib/searchIndex";
import { evidenceLevelV } from "./schema";

// Overridable so isolated test backends never touch the shared index.
const INDEX = process.env.MOSS_SEARCH_INDEX || PUBLIC_INDEX_NAME;
// The first query in a fresh process downloads and loads the embedding model (~6 s on Convex).
const QUERY_TIMEOUT_MS = 20_000;
// A hung Moss step must not leave a rebuild pending forever.
const STEP_MS = { getDocs: 30_000, deleteIndex: 30_000, createIndex: 180_000 };
const RELOAD_AFTER_MS = 60_000;
const CACHE_DIR = join(tmpdir(), "moss");

// Index management runs on the Moss service, so it works in-process.
let client: MossClient | null = null;

function getClient(): MossClient | null {
  const creds = mossCredentials();
  if (!creds) return null;
  client ??= new MossClient(creds.projectId, creds.projectKey, { cachePath: CACHE_DIR });
  return client;
}

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${what} timed out`)), ms))]);
}

const reason = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 160);

// Queries embed the text locally, and the Moss core caches its embedding model under $MOSS_MODEL_CACHE_DIR,
// else under the home directory. On Convex, `process.env` changes never reach the OS environment the native
// core reads, HOME is unset, and the passwd home is read-only, so in-process loading fails with
// "The embedding model could not be loaded." A child process gets a real environment pointing at /tmp.
// It stays alive between calls, because Node action processes are reused, so the index stays warm.
const WORKER = `
const { MossClient } = await import(process.env.MOSS_SDK_URL);
const client = new MossClient(process.env.MOSS_PROJECT_ID, process.env.MOSS_PROJECT_KEY, { cachePath: process.env.MOSS_CACHE });
const loadedAt = new Map();
process.on("message", async ({ id, op, index, text, topK, reloadAfterMs }) => {
  try {
    if (op === "invalidate") { loadedAt.delete(index); return process.send({ id, ok: true }); }
    if (!loadedAt.has(index) || Date.now() - loadedAt.get(index) > reloadAfterMs) {
      await client.loadIndex(index);
      loadedAt.set(index, Date.now());
    }
    const res = await client.query(index, text, { topK });
    process.send({ id, ok: true, docs: (res.docs ?? []).map((d) => ({ id: String(d.id), score: Number(d.score ?? 0) })) });
  } catch (e) {
    loadedAt.delete(index);
    process.send({ id, ok: false, error: String(e?.detail ?? e?.message ?? e) });
  }
});
`;

type WorkerReply = { id: number; ok: boolean; docs?: SemanticCandidate[]; error?: string };
let worker: { proc: ChildProcess; pending: Map<number, (r: WorkerReply) => void> } | null = null;
let nextId = 1;

function getWorker(creds: { projectId: string; projectKey: string }) {
  if (worker && worker.proc.exitCode === null && worker.proc.connected) return worker;
  mkdirSync(join(CACHE_DIR, "models"), { recursive: true });
  const sdk = pathToFileURL(createRequire(import.meta.url).resolve("@moss-js/moss")).href;
  const proc = spawn(process.execPath, ["--input-type=module", "-e", WORKER], {
    stdio: ["ignore", "ignore", "ignore", "ipc"],
    env: {
      PATH: process.env.PATH ?? "/usr/bin:/bin",
      HOME: tmpdir(),
      MOSS_MODEL_CACHE_DIR: join(CACHE_DIR, "models"),
      MOSS_CACHE: CACHE_DIR,
      MOSS_SDK_URL: sdk,
      MOSS_PROJECT_ID: creds.projectId,
      MOSS_PROJECT_KEY: creds.projectKey,
    },
  });
  const w = { proc, pending: new Map<number, (r: WorkerReply) => void>() };
  proc.on("message", (r: WorkerReply) => {
    w.pending.get(r.id)?.(r);
    w.pending.delete(r.id);
  });
  proc.on("exit", () => {
    for (const [id, done] of w.pending) done({ id, ok: false, error: "The Moss query worker exited" });
    w.pending.clear();
    if (worker === w) worker = null;
  });
  proc.on("error", () => proc.kill());
  // An idle worker must not keep the action process alive.
  proc.unref();
  proc.channel?.unref();
  worker = w;
  return w;
}

function ask(creds: { projectId: string; projectKey: string }, msg: Record<string, unknown>): Promise<WorkerReply> {
  const w = getWorker(creds);
  const id = nextId++;
  return new Promise<WorkerReply>((resolve) => {
    w.pending.set(id, resolve);
    w.proc.send({ id, ...msg });
  });
}

type Semantic = { candidates: SemanticCandidate[]; latencyMs: number } | { error: string };

async function semanticCandidates(text: string): Promise<Semantic> {
  const creds = mossCredentials();
  if (!creds) return { error: "Moss is not configured" };
  try {
    const t0 = performance.now();
    const msg = { op: "query", index: INDEX, text: text.slice(0, 1000), topK: SEMANTIC_TOP_K, reloadAfterMs: RELOAD_AFTER_MS };
    const res = await withTimeout(ask(creds, msg), QUERY_TIMEOUT_MS, "Moss query");
    if (!res.ok) throw new Error(res.error ?? "Moss query failed");
    return {
      latencyMs: Math.round(performance.now() - t0),
      // Weak neighbours are dropped so an unrelated query still gets "no relevant match".
      candidates: (res.docs ?? []).filter((d) => d.score >= MIN_SEMANTIC_SCORE),
    };
  } catch (e) {
    // A worker that timed out may be wedged; start a fresh one next time.
    if (reason(e).endsWith("timed out")) worker?.proc.kill();
    return { error: reason(e) };
  }
}

export type Retrieval = { engine: SearchEngine; index: string; latencyMs?: number; fallbackReason?: string };

const retrievalOf = (s: Semantic): Retrieval =>
  "error" in s ? { engine: "keyword_fallback", index: INDEX, fallbackReason: s.error } : { engine: "moss_semantic", index: INDEX, latencyMs: s.latencyMs };

/** Rebuild the shared index when its documents differ from the active public previews. */
export const rebuildPublicIndex = internalAction({
  args: {},
  handler: async (ctx): Promise<{ ok: boolean; rebuilt: boolean; docs: number; error?: string }> => {
    const c = getClient();
    if (!c) return { ok: false, rebuilt: false, docs: 0, error: "Moss is not configured" };
    const docs = await ctx.runQuery(internal.searchIndex.publicIndexSource, {});
    // Keep the old index rather than deleting it; search only ever returns active guides anyway.
    if (docs.length === 0) return { ok: false, rebuilt: false, docs: 0, error: "no public previews to index" };
    try {
      const remote = await withTimeout(c.getDocs(INDEX), STEP_MS.getDocs, "getDocs").catch(() => null);
      if (remote && sameDocs(remote as never, docs)) return { ok: true, rebuilt: false, docs: docs.length };
      // deleteIndex resolves false when the index does not exist; a real failure stops the rebuild.
      await withTimeout(c.deleteIndex(INDEX), STEP_MS.deleteIndex, "deleteIndex");
      await withTimeout(c.createIndex(INDEX, docs), STEP_MS.createIndex, "createIndex");
      const creds = mossCredentials();
      if (worker && creds) await withTimeout(ask(creds, { op: "invalidate", index: INDEX }), 5_000, "invalidate").catch(() => {});
      await ctx.runMutation(internal.searchIndex.recordEvent, { outcome: "success", message: `Rebuilt the Moss public-preview index (${docs.length} guides).` });
      return { ok: true, rebuilt: true, docs: docs.length };
    } catch (e) {
      await ctx.runMutation(internal.searchIndex.recordEvent, { outcome: "failure", message: `Moss public-preview index build failed: ${reason(e)}` });
      return { ok: false, rebuilt: false, docs: docs.length, error: reason(e) };
    }
  },
});

/** Buyer web search: Moss semantic candidates, then server-side filtering, entitlement, and explanations. */
export const buyerSearch = action({
  args: {
    actor: v.string(),
    query: v.string(),
    category: v.optional(v.string()),
    evidenceLevel: v.optional(evidenceLevelV),
    maxPriceAtomic: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ retrieval: Retrieval | null; results: SearchResults }> => {
    const hasQuery = args.query.trim().length > 0;
    const sem: Semantic | null = hasQuery && args.query.length <= 600 ? await semanticCandidates(args.query) : null;
    const semantic = sem && !("error" in sem) ? sem.candidates : undefined;
    const results: SearchResults = await ctx.runQuery(internal.playbooks.searchRanked, { ...args, semantic });
    if (sem && "error" in sem) {
      await ctx.runMutation(internal.searchIndex.recordEvent, { outcome: "failure", message: `Moss search unavailable (${sem.error}); used keyword matching.` });
    }
    return { retrieval: sem ? retrievalOf(sem) : null, results };
  },
});

/** MCP search_resolutions: same index; Convex still enforces the principal, scope, and approval. */
export const mcpSearch = action({
  args: { svc: v.string(), token: v.string(), symptoms: v.string(), environment: v.array(v.string()) },
  handler: async (ctx, args): Promise<{ retrieval: Retrieval; results: unknown[] }> => {
    const sem = args.symptoms.length <= 2000 ? await semanticCandidates(`${args.symptoms}\n${args.environment.join(", ")}`) : { error: "Query too long" };
    const results: unknown[] = await ctx.runQuery(api.mcp.search, { ...args, ...("error" in sem ? {} : { semantic: sem.candidates }) });
    return { retrieval: retrievalOf(sem), results };
  },
});
