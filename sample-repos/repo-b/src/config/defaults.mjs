// order-sync: static defaults (not part of the fix surface).
export const QUEUE_NAME = "order-sync-tasks";
export const MAX_BODY_BYTES = 64 * 1024;
export const SUPPORTED_KINDS = Object.freeze(["order.created", "order.updated", "order.cancelled"]);
