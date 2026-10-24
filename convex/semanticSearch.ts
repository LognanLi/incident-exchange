"use node";
// Semantic search over the shared Moss index of public previews. Used by buyer web search and MCP search.
// Moss failures never block search: results fall back to keyword clue matching, labeled with the reason.
import { v } from "convex/values";
import type { SearchResults } from "./playbooks";
import { MossClient } from "@moss-js/moss";
import { action, internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { mossCredentials } from "./lib/moss";
import { MIN_SEMANTIC_SCORE, PUBLIC_INDEX_NAME, SEMANTIC_TOP_K, sameDocs, type SemanticCandidate, type SearchEngine } from "./lib/searchIndex";
import { evidenceLevelV } from "./schema";

// Overridable so isolated test backends never touch the shared index.
const INDEX = process.env.MOSS_SEARCH_INDEX || PUBLIC_INDEX_NAME;
const QUERY_TIMEOUT_MS = 15_000;
const RELOAD_AFTER_MS = 60_000;

// Node action processes are reused between calls, so keep the loaded index warm.
let client: MossClient | null = null;
let loaded: { at: number; promise: Promise<unknown> } | null = null;

function getClient(): MossClient | null {
  const creds = mossCredentials();
  if (!creds) return null;
  // The Convex Node runtime can only write to /tmp; Moss downloads its embedding model and device id there.
  process.env.MOSS_MODEL_CACHE_DIR ??= "/tmp/moss-models";
  client ??= new MossClient(creds.projectId, creds.projectKey, { cachePath: "/tmp/moss" });
  return client;
}

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${what} timed out`)), ms))]);
}

const reason = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 160);

type Semantic = { candidates: SemanticCandidate[]; latencyMs: number } | { error: string };

async function semanticCandidates(text: string): Promise<Semantic> {
  const c = getClient();
  if (!c) return { error: "Moss is not configured" };
  try {
    if (!loaded || Date.now() - loaded.at > RELOAD_AFTER_MS) {
      const promise = c.loadIndex(INDEX);
      loaded = { at: Date.now(), promise };
      promise.catch(() => (loaded = null));
    }
    await withTimeout(loaded.promise, QUERY_TIMEOUT_MS, "Loading the Moss index");
    const t0 = performance.now();
    const res = await withTimeout(c.query(INDEX, text.slice(0, 1000), { topK: SEMANTIC_TOP_K }), QUERY_TIMEOUT_MS, "Moss query");
    return {
      latencyMs: Math.round(performance.now() - t0),
      // Weak neighbours are dropped so an unrelated query still gets "no relevant match".
      candidates: (res.docs ?? []).map((d) => ({ id: String(d.id), score: Number(d.score ?? 0) })).filter((d) => d.score >= MIN_SEMANTIC_SCORE),
    };
  } catch (e) {
    loaded = null;
    return { error: reason(e) };
  }
}

export type Retrieval = { engine: SearchEngine; latencyMs?: number; fallbackReason?: string };

const retrievalOf = (s: Semantic): Retrieval =>
  "error" in s ? { engine: "keyword_fallback", fallbackReason: s.error } : { engine: "moss_semantic", latencyMs: s.latencyMs };

/** Rebuild the shared index when its documents differ from the active public previews. */
export const rebuildPublicIndex = internalAction({
  args: {},
  handler: async (ctx): Promise<{ ok: boolean; rebuilt: boolean; docs: number; error?: string }> => {
    const c = getClient();
    if (!c) return { ok: false, rebuilt: false, docs: 0, error: "Moss is not configured" };
    const docs = await ctx.runQuery(internal.searchIndex.publicIndexSource, {});
    try {
      const remote = await c.getDocs(INDEX).catch(() => null);
      if (remote && sameDocs(remote as never, docs)) return { ok: true, rebuilt: false, docs: docs.length };
      await c.deleteIndex(INDEX).catch(() => undefined);
      if (docs.length) await c.createIndex(INDEX, docs);
      loaded = null;
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
