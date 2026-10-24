# repo-b: order-sync (toy)

A message-bus consumer that queues order-sync tasks for each incoming message.
Bug: the broker redelivers messages, and each redelivery queues a duplicate task.
Editable file: `src/consumer/messageConsumer.mjs` only. `src/config/defaults.mjs` is read-only.
Tests in `protected-tests/` are run by a separate runner.
