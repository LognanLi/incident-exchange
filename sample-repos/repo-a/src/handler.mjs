// billing-events: webhook event handler.
// The provider may retry the same delivery (same event.id) several times.

export function createEventHandler(store) {
  return {
    async handle(event) {
      await store.insertJob({
        eventId: event.id,
        type: event.type,
        payload: event.payload,
      });
      return { status: 200, outcome: "processed" };
    },
  };
}
