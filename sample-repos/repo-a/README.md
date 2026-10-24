# repo-a: billing-events (toy)

A tiny webhook handler that turns provider events into billing jobs.
Bug: the provider retries deliveries, and each retry creates a duplicate job.
Editable file: `src/handler.mjs` only. Tests in `protected-tests/` are run by a separate runner.
