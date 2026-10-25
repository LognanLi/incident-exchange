# repo-c: invoice-api (toy, fictional)

A tiny invoice service for a multi-tenant billing product. Every invoice belongs to one tenant.
Bug: invoices are fetched (and voided) by the client-supplied `invoiceId` without checking that the
invoice belongs to the caller's authenticated tenant, so one tenant can read or void another tenant's
invoice by guessing or enumerating ids (cross-tenant read / IDOR).

Editable file: `src/invoices.mjs` only. `reference-fix/invoices.mjs` is the contributor's own fix
(ownership check against `caller.tenantId`; other tenants' invoices answer exactly like a missing id).
Tests in `protected-tests/` are run by a separate runner.
