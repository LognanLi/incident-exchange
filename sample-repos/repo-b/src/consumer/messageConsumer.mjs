// order-sync: message bus consumer.
// The upstream broker redelivers messages (same msg.messageId) on timeouts.

import { QUEUE_NAME } from "../config/defaults.mjs";

/**
 * @param {{ ledger: import("../ports.mjs").Ledger, queue: import("../ports.mjs").Queue }} deps
 * @returns {{ onMessage(msg: { messageId: string, kind: string, body: unknown }): Promise<import("../ports.mjs").ConsumerResult> }}
 */
export function makeConsumer({ ledger, queue }) {
  return {
    async onMessage(msg) {
      await queue.push({
        queue: QUEUE_NAME,
        sourceMessageId: msg.messageId,
        kind: msg.kind,
        body: msg.body,
      });
      return { ack: true, result: "queued" };
    },
  };
}
