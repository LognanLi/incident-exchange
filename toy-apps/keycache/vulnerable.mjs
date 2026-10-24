// Toy signed-event verifier (fictional, local only) — VULNERABLE version.
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
// Bug: keys are fetched once and cached forever, so after the provider rotates keys every event
// signed with the new kid is rejected.
export function createVerifier(keySource, options) {
  let keys = null;
  return {
    async verify({ kid, signature, body }) {
      if (!keys) keys = await keySource.fetchKeys();
      const secret = keys[kid];
      if (!secret) return { ok: false, reason: "unknown kid" };
      if (options.mac(secret, body) !== signature) return { ok: false, reason: "bad signature" };
      return { ok: true, reason: "verified" };
    },
  };
}
