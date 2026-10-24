# Toy apps

Tiny, fictional, deterministic services used as reproduction targets for incident guides. Pure ESM, no imports,
no timers/clock/randomness, so they load both in Node and inside a Convex bundle.

Each case in `<case>/` has:

- `vulnerable.mjs` — the buggy implementation. The Factory runner copies it to `handler.mjs` in an empty temp workspace;
  that copy is the only file the repair agent may edit.
- `fixed.mjs` — reference defensive fix (used by the deterministic local patch adapter).
- `evaluate.mjs` — protected evaluator: `evaluate(mod) -> { passed, summary, assertions[] }`. It FAILS the vulnerable
  version and PASSES the fix, and includes legitimate-behavior checks so "deny everything" does not pass.

| case | API | defensive goal |
| --- | --- | --- |
| `webhook` | `createWebhookService(store).handleDelivery({ id, type, payload })` | idempotency by event id via the store's atomic `insertIfAbsent` |
| `tenant` | `createExportService(db).getExport(session, exportId)` | tenant-scoped authorization, own-tenant access preserved |
| `keycache` | `createVerifier(keySource, options).verify({ kid, signature, body })` | rate-limited key refresh on unknown kid, never skip verification |

`index.mjs` exports `CASES` (static imports). `run-evaluation.mjs` is the sandboxed child-process entry used by
`scripts/factory-runner.mjs` (Node permission model, read-only, per-run nonce). Run artifacts go to `artifacts/`.

```sh
node --test toy-apps/toy.test.mjs                    # vulnerable fails, fixed passes, deny-stubs fail
node scripts/factory-runner.mjs --selftest webhook   # same, through the sandboxed child-process path
```
