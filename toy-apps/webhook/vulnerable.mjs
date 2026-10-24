// Toy webhook receiver (fictional, local only) — VULNERABLE version.
//
// API:
//   export function createWebhookService(store)
//     store (supplied by the evaluator):
//       await store.insertIfAbsent(key) -> true if key was newly inserted, false if it already existed (atomic)
//       await store.has(key)            -> boolean
//       await store.enqueueJob(job)     -> void   (job = { id, type, payload })
//   service.handleDelivery({ id, type, payload }) -> Promise<{ status: 200, outcome: "enqueued" | "duplicate" }>
//
// Bug: every delivery is enqueued, so provider retries (same event id) create duplicate jobs.
export function createWebhookService(store) {
  return {
    async handleDelivery({ id, type, payload }) {
      await store.enqueueJob({ id, type, payload });
      return { status: 200, outcome: "enqueued" };
    },
  };
}
