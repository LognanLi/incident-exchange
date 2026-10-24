// Toy signed-event verifier (fictional, local only) — FIXED version.
//
// API:
//   export function createVerifier(keySource, options)
//     keySource (supplied by the evaluator):
//       await keySource.fetchKeys() -> { [kid]: secret }   (current key set; each call is counted)
//     options (supplied by the evaluator):
//       options.mac(secret, body) -> string   toy deterministic signature function (NOT real crypto)
//       options.now() -> number               injected clock in milliseconds
//       options.minRefreshIntervalMs          minimum time between key refreshes (default 10000)
//   verifier.verify({ kid, signature, body }) -> Promise<{ ok: boolean, reason: string }>
//
// Fix: on an unknown kid, refresh the key set once (rate-limited by the injected clock) and retry.
// A kid that is still unknown after the refresh is rejected; signature checks are never skipped.
export function createVerifier(keySource, options) {
  const minInterval = Number.isFinite(options.minRefreshIntervalMs) ? options.minRefreshIntervalMs : 10000;
  let keys = null;
  let lastFetch = -Infinity;

  async function refresh() {
    keys = (await keySource.fetchKeys()) || {};
    lastFetch = options.now();
  }

  return {
    async verify({ kid, signature, body }) {
      if (!keys) await refresh();
      let secret = Object.prototype.hasOwnProperty.call(keys, kid) ? keys[kid] : undefined;
      if (!secret && options.now() - lastFetch >= minInterval) {
        await refresh();
        secret = Object.prototype.hasOwnProperty.call(keys, kid) ? keys[kid] : undefined;
      }
      if (!secret) return { ok: false, reason: "unknown kid" };
      if (typeof signature !== "string" || options.mac(secret, body) !== signature) return { ok: false, reason: "bad signature" };
      return { ok: true, reason: "verified" };
    },
  };
}
