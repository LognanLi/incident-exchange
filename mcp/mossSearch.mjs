// Moss retrieval for MCP search: one shared index of PUBLIC previews only (approved, active guides).
// Built/refreshed by the MCP service; queried in-process after loadIndex. Falls back (labeled) if Moss fails.
import { MossClient } from "@moss-js/moss";
import { createHash } from "node:crypto";

const INDEX = "ix-public-previews";
let client = null;
let state = { ready: false, hash: "", builtAt: 0, error: null, building: null };

export function mossStatus() {
  return { ready: state.ready, builtAt: state.builtAt, error: state.error, building: Boolean(state.building) };
}

// Every Moss step gets a deadline: a hung step would otherwise leave `building` pending forever,
// which blocks every later refresh while status reads ready:false, error:null.
const STEP_MS = { deleteIndex: 30_000, createIndex: 180_000, loadIndex: 180_000 };
const step = (name, p) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`${name} timed out after ${STEP_MS[name] / 1000}s`)), STEP_MS[name]).unref())]).catch((e) => {
    throw new Error(`${name}: ${e?.message ?? e}`);
  });

export function initMoss(projectId, projectKey) {
  if (projectId && projectKey) client = new MossClient(projectId, projectKey);
}

/** Rebuild only when the set of public previews changed. */
export async function refresh(previews) {
  if (!client) return;
  const hash = createHash("sha256").update(JSON.stringify(previews.map((p) => [p.id, p.revision, p.text]))).digest("hex");
  if (state.ready && hash === state.hash) return;
  if (state.building) return state.building;
  if (previews.length === 0) {
    state = { ...state, ready: false, error: "no public previews to index" };
    return;
  }
  state.building = (async () => {
    try {
      // deleteIndex resolves false when the index does not exist; real failures are recorded, not hidden.
      await step("deleteIndex", client.deleteIndex(INDEX)).catch((e) => console.warn(`[moss] ${e.message}`));
      await step("createIndex", client.createIndex(INDEX, previews.map((p) => ({ id: p.id, text: p.text, metadata: { revision: String(p.revision) } }))));
      await step("loadIndex", client.loadIndex(INDEX));
      state = { ready: true, hash, builtAt: Date.now(), error: null, building: null };
      console.log(`[moss] ${INDEX} ready (${previews.length} previews)`);
    } catch (e) {
      // Keep serving the previously loaded index if there is one; just surface the error.
      state = { ...state, error: String(e?.message ?? e).slice(0, 200), building: null };
      console.warn(`[moss] refresh failed: ${state.error}`);
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
    return { latencyMs, candidates: (res.docs ?? [])
      .map((d) => ({ id: String(d.id), score: Number(d.score ?? 0) }))
      .filter((c) => c.score > 0) }; // topK always fills 8 slots; score-0 docs are not semantic matches
  } catch (e) {
    state.error = String(e?.message ?? e).slice(0, 160);
    return null;
  }
}
