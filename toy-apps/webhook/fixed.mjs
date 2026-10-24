// Toy webhook receiver (fictional, local only) — FIXED version.
//
// API:
//   export function createWebhookService(store)
//     store (supplied by the evaluator):
//       await store.insertIfAbsent(key) -> true if key was newly inserted, false if it already existed (atomic)
//       await store.has(key)            -> boolean
//       await store.enqueueJob(job)     -> void   (job = { id, type, payload })
//   service.handleDelivery({ id, type, payload }) -> Promise<{ status: 200, outcome: "enqueued" | "duplicate" }>
//
// Fix: idempotency keyed by event id using the store's atomic insert-if-absent. The dedupe record lives in
// the shared store (not in process memory), so it survives restarts and concurrent deliveries.
export function createWebhookService(store) {
  return {
    async handleDelivery({ id, type, payload }) {
      const isNew = await store.insertIfAbsent(`webhook-event:${id}`);
      if (!isNew) return { status: 200, outcome: "duplicate" };
      await store.enqueueJob({ id, type, payload });
      return { status: 200, outcome: "enqueued" };
    },
  };
}
