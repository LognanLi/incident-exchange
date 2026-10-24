// Moss retrieval for MCP search: one shared index of PUBLIC previews only (approved, active guides).
// Built/refreshed by the MCP service; queried in-process after loadIndex. Falls back (labeled) if Moss fails.
import { MossClient } from "@moss-js/moss";
import { createHash } from "node:crypto";

const INDEX = "ix-public-previews";
let client = null;
let state = { ready: false, hash: "", builtAt: 0, error: null, building: null };

export function mossStatus() {
  return { ready: state.ready, builtAt: state.builtAt, error: state.error };
}

export function initMoss(projectId, projectKey) {
  if (projectId && projectKey) client = new MossClient(projectId, projectKey);
}

/** Rebuild only when the set of public previews changed. */
export async function refresh(previews) {
  if (!client) return;
  const hash = createHash("sha256").update(JSON.stringify(previews.map((p) => [p.id, p.revision, p.text]))).digest("hex");
  if (state.ready && hash === state.hash) return;
  if (state.building) return state.building;
  state.building = (async () => {
    try {
      await client.deleteIndex(INDEX).catch(() => undefined);
      await client.createIndex(INDEX, previews.map((p) => ({ id: p.id, text: p.text, metadata: { revision: String(p.revision) } })));
      await client.loadIndex(INDEX);
      state = { ready: true, hash, builtAt: Date.now(), error: null, building: null };
    } catch (e) {
      state = { ...state, ready: false, error: String(e?.message ?? e).slice(0, 160), building: null };
    }
  })();
  return state.building;
}

/** Returns [{id, score}] or null when Moss is unavailable (caller labels the fallback). */
export async function semanticCandidates(text) {
  if (!client || !state.ready) return null;
  try {
    const t0 = performance.now();
    const res = await client.query(INDEX, text.slice(0, 1000), { topK: 8 });
    const latencyMs = Math.round(performance.now() - t0);
    return { latencyMs, candidates: (res.docs ?? []).map((d) => ({ id: String(d.id), score: Number(d.score ?? 0) })) };
  } catch (e) {
    state.error = String(e?.message ?? e).slice(0, 160);
    return null;
  }
}
