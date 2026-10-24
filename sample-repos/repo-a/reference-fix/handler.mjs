// billing-events: webhook event handler (reference fix).
// Idempotent on event.id: reserve before work, release on failure so a
// legitimate provider retry can still succeed.

export function createEventHandler(store) {
  return {
    async handle(event) {
      const reserved = await store.reserve(event.id);
      if (!reserved) {
        return { status: 200, outcome: "duplicate" };
      }
      try {
        await store.insertJob({
          eventId: event.id,
          type: event.type,
          payload: event.payload,
        });
      } catch (err) {
        await store.release(event.id);
        throw err;
      }
      return { status: 200, outcome: "processed" };
    },
  };
}
