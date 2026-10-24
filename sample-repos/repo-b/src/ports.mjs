// order-sync: interfaces injected into the consumer (documentation only; not editable by agents).

/**
 * Durable ledger of message ids, shared across consumer instances.
 * @typedef {Object} Ledger
 * @property {(id: string) => Promise<boolean>} claim   Atomically record `id`; resolves false if it was already claimed.
 * @property {(id: string) => Promise<void>} unclaim    Remove a claim (e.g. when processing failed and should be retried).
 */

/**
 * Work queue for order-sync tasks.
 * @typedef {Object} Queue
 * @property {(task: object) => Promise<void>} push
 * @property {() => Promise<number>} size
 */

/**
 * Value returned by `onMessage`. Every handled message is acknowledged.
 * @typedef {{ ack: true, result: "queued" | "skipped_duplicate" }} ConsumerResult
 */

export const RESULT = Object.freeze({ QUEUED: "queued", SKIPPED_DUPLICATE: "skipped_duplicate" });
