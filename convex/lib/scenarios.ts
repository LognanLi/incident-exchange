// Seeded incident scenarios for the polish sprint. Contract: ./scenarioTypes.ts.
// All organizations, people, hosts, customers, numbers, and outcomes are FICTIONAL demonstration
// content. Every guide is DEFENSIVE: detection, containment, recovery, verification.
// Identifiers in PRIMARY_DRAFT are deliberately planted (reserved .example domains) so the
// privacy scanner has something to catch. Catalog text must stay free of identifiers.

import type { PrimaryDraftSeed, ScenarioGuide } from "./scenarioTypes";

// ---------------------------------------------------------------------------
// Primary case: Northstar Cloud, seeded as a contributor DRAFT.
// ---------------------------------------------------------------------------

export const PRIMARY_DRAFT: PrimaryDraftSeed = {
  title: "Northstar: duplicate jobs after webhook retries (demo-client-42)",
  publicTitle: "Duplicate jobs after webhook retries from a payment or event provider",
  sanitizedSummary:
    "On 2026-09-18 14:07 UTC, Northstar's job service at hooks.internal.northstar.example started creating duplicate job records for demo-client-42. " +
    "The provider retried the same event when our acknowledgement was slow, and the service treated each delivery as new work. " +
    "Maya Okafor (ops@northstar.example) traced it to missing persistent idempotency keyed by the provider event ID.",
  systemCategories: ["Deployment & CI/CD", "Logging & monitoring"],
  environment: ["Webhook receiver", "Background job queue", "Relational database", "Third-party event provider"],
  privateNotes:
    "Internal only. Paged at 2026-09-18 14:07 UTC; Maya Okafor was on call, escalated via ops@northstar.example. " +
    "Receiver runs behind hooks.internal.northstar.example. Affected customer label: demo-client-42 (roughly 300 synthetic duplicate jobs in the demo dataset). " +
    "The in-memory dedupe cache was lost on each worker restart, which is why restarts looked like they helped and then didn't. " +
    "Handler did a synchronous downstream call before returning 200, pushing ack latency past the provider's retry window.",
  evidenceSummary:
    "Contributor-supplied redacted receiver logs showing the same provider event ID delivered three times and producing three job rows; " +
    "after the fix, a toy webhook service receives the same synthetic event twice and creates exactly one job.",
  identifyingTerms: ["demo-client-42", "Maya Okafor"],
  symptoms:
    "- Starting 2026-09-18 14:07 UTC, demo-client-42 saw two or three identical jobs for a single order.\n" +
    "- The job queue at hooks.internal.northstar.example backed up and processing latency climbed.\n" +
    "- Northstar support received duplicate-order reports routed to ops@northstar.example.",
  detectionClues:
    "- The same provider event ID appears on more than one job record.\n" +
    "- Duplicate deliveries line up with provider retry attempts that followed slow acknowledgements.\n" +
    "- Maya Okafor noticed the queue refilled within minutes of every worker restart.",
  attemptedActions:
    "- Compared job records against provider delivery logs, grouped by event ID.\n" +
    "- Measured acknowledgement latency on the receiver at hooks.internal.northstar.example and found it often exceeded the provider's retry timeout.\n" +
    "- Confirmed the existing dedupe check lived only in worker memory.",
  failedAttempts:
    "- Restarting workers cleared queue congestion for a while, but duplicates returned because the provider kept retrying and the in-memory dedupe cache was wiped on restart.\n" +
    "- Raising worker concurrency drained the backlog faster but created duplicates faster too, since two workers could pick up two deliveries of the same event at once.\n" +
    "- A check-then-insert dedupe query reduced duplicates but still let some through under concurrent deliveries (race between the check and the insert).",
  containmentSteps:
    "- Pause automatic downstream side effects (fulfilment, notifications) for demo-client-42 while duplicates are being reconciled.\n" +
    "- Change the receiver to acknowledge quickly after durably recording the delivery, and move processing to an async worker.\n" +
    "- Keep provider retries enabled; do not disable them, because they are how missed events get recovered.",
  recoverySteps:
    "- Add a persistent idempotency record keyed by provider event ID, enforced with a unique constraint (insert-if-absent), before creating any job.\n" +
    "- Identify duplicate jobs created since 2026-09-18 14:07 UTC by grouping on event ID, keep the first, and cancel or merge the rest.\n" +
    "- Follow the provider's documented retry semantics, including how long an event can be redelivered, when choosing how long to keep idempotency records.\n" +
    "- Notify affected customers (Maya Okafor coordinated with ops@northstar.example) once reconciliation is complete.",
  verificationSteps:
    "- Deliver the same synthetic event twice to a test copy of hooks.internal.northstar.example and confirm exactly one job is created.\n" +
    "- Send two deliveries of the same event concurrently and confirm the unique constraint rejects the second insert without an error loop.\n" +
    "- Confirm a genuinely new event ID still creates a new job, and that acknowledgement latency stays well inside the provider's retry timeout.",
  limitations:
    "- Applies when duplicates share the same provider event ID; it does not fix duplication that happens upstream of the provider.\n" +
    "- Northstar's setup used a relational database with unique constraints; other stores need an equivalent atomic insert-if-absent.\n" +
    "- Tested only on a toy webhook service and the contributor's own system for demo-client-42, not on buyer systems.",
  clues: [
    {
      id: "same-event-id-two-jobs",
      label: "Same webhook event ID creates two or more jobs",
      terms: ["same event id", "duplicate event", "duplicate jobs", "duplicate orders", "double processing", "processed twice", "duplicate webhook", "event id"],
      weight: "key",
    },
    {
      id: "dupes-follow-retries",
      label: "Duplicates line up with provider retries or slow acknowledgements",
      terms: ["webhook retry", "retries", "retried", "redelivery", "slow ack", "acknowledgement timeout", "ack timeout", "timeout", "at least once"],
      weight: "key",
    },
    {
      id: "queue-refills-after-restart",
      label: "Queue refills soon after worker restart",
      terms: ["queue backlog", "queue congestion", "restart workers", "worker restart", "backlog returns", "queue refills"],
      weight: "supporting",
    },
    {
      id: "in-memory-dedupe",
      label: "Deduplication lives only in memory or uses check-then-insert",
      terms: ["in-memory cache", "dedupe", "deduplication", "race condition", "check then insert", "idempotency"],
      weight: "supporting",
    },
  ],
  mismatchSignals: [
    {
      id: "different-event-ids",
      label: "Duplicates have different event IDs",
      terms: ["different event ids", "unique event ids", "distinct ids", "upstream duplicate"],
      explanation:
        "If each duplicate carries its own event ID, the provider or an upstream system created separate events. Idempotency on event ID will not catch it; investigate upstream duplication instead.",
    },
    {
      id: "idempotency-already-persistent",
      label: "Idempotency is already persistent, but side effects still duplicate",
      terms: ["already idempotent", "unique constraint exists", "duplicate emails", "duplicate side effects", "downstream duplicate"],
      explanation:
        "If job creation is already deduplicated in durable storage, the duplication is likely in a downstream side effect (email, charge, shipment) that needs its own idempotency.",
    },
    {
      id: "different-delivery-contract",
      label: "Provider's delivery contract differs (no retries, or no stable event ID)",
      terms: ["no retries", "exactly once", "no event id", "fifo", "ordered delivery"],
      explanation:
        "This guide assumes at-least-once delivery with a stable event ID. Providers with a different contract need a different dedupe key or approach.",
    },
  ],
  checksBeforeUse: [
    "Confirm duplicate records share the same provider event ID.",
    "Check whether duplicates line up in time with provider retry attempts.",
    "Measure how long your receiver takes to acknowledge versus the provider's documented retry timeout.",
    "Confirm where your current dedupe check lives (memory, cache, or durable storage with a unique constraint).",
  ],
  evidenceScope:
    "Fix reproduced in a toy webhook service: the same synthetic event delivered twice creates one job. Not tested on buyer systems.",
  price: { amountAtomic: "500000", currency: "USDC", decimals: 6 },
  toyCase: "webhook",
};

// ---------------------------------------------------------------------------
// Published catalog (6 listings). Buyer-facing text: no identifiers of any kind.
// ---------------------------------------------------------------------------

export const CATALOG: ScenarioGuide[] = [
  // 1. Webhook family: related but different cause (client retries without idempotency keys).
  {
    key: "client-retry-duplicate-captures",
    family: "webhook_idempotency",
    contributorSlug: "cobalt",
    publicTitle: "Duplicate payment captures from client request retries",
    publicSummary:
      "A checkout client retried capture requests after network timeouts without sending an idempotency key, so the payment API treated each retry as a new capture.",
    systemCategories: ["Deployment & CI/CD", "Network edge"],
    environment: ["Mobile and web checkout clients", "Payment API", "API gateway"],
    clues: [
      {
        id: "double-charge",
        label: "Customers charged twice for one order",
        terms: ["double charge", "charged twice", "duplicate capture", "duplicate payment", "double billing"],
        weight: "key",
      },
      {
        id: "client-timeout-retry",
        label: "Duplicates follow client-side timeouts and automatic retries",
        terms: ["client retry", "request retry", "network timeout", "retry on timeout", "mobile retry"],
        weight: "key",
      },
      {
        id: "no-idempotency-header",
        label: "Capture requests arrive without an idempotency key",
        terms: ["idempotency key", "missing idempotency", "no idempotency header", "dedupe"],
        weight: "supporting",
      },
    ],
    mismatchSignals: [
      {
        id: "server-webhook-retries",
        label: "Duplicates come from provider webhook redelivery, not client requests",
        terms: ["webhook retry", "provider retry", "same event id", "redelivery"],
        explanation:
          "If the duplicate work is triggered by inbound webhook redeliveries, the fix belongs in the webhook receiver (event-ID idempotency), not in client request keys.",
      },
      {
        id: "distinct-carts",
        label: "Duplicate charges belong to separate carts or sessions",
        terms: ["different cart", "separate session", "two orders"],
        explanation: "Separate carts usually mean the user really submitted twice; that is a UX or fraud question, not a retry bug.",
      },
    ],
    checksBeforeUse: [
      "Confirm duplicate captures come from the same client session within a short window.",
      "Check whether duplicate requests carried an idempotency key.",
      "Check client retry settings for capture and other non-idempotent calls.",
    ],
    evidenceScope: "Contributor's account; a reviewer inspected redacted gateway logs showing repeated capture requests without idempotency keys. Not reproduced.",
    sections: {
      recognize:
        "- Customers report being charged twice for a single order.\n" +
        "- Duplicate captures are seconds apart and follow client network timeouts.\n" +
        "- Capture requests in gateway logs carry no idempotency key.",
      check:
        "- Group captures by client session and order to see whether duplicates share a session.\n" +
        "- Inspect client retry policy for non-idempotent endpoints.\n" +
        "- Confirm whether the payment API supports idempotency keys and how long it honours them.",
      contain:
        "- Disable automatic client retries on capture calls until keys are in place.\n" +
        "- Add a server-side guard that flags a second capture for the same order within a short window for review.",
      recover:
        "- Generate an idempotency key per checkout attempt on the client and send it with every capture retry.\n" +
        "- Refund confirmed duplicate captures and notify affected customers.\n" +
        "- Re-enable client retries only for requests that carry a key.",
      verify:
        "- In a test environment, force a timeout after capture and confirm the retry returns the original result instead of a new capture.\n" +
        "- Confirm a genuinely new checkout still creates a new capture.",
      limitations:
        "- Applies to client-initiated retries; it does not address inbound webhook redelivery.\n" +
        "- Depends on the payment API honouring idempotency keys for long enough to cover client retries.",
    },
    failedAttempts:
      "- Lowering the client timeout made duplicates more frequent, because more requests timed out and were retried.\n" +
      "- A nightly reconciliation job caught duplicates but only after customers had already noticed.",
    evidenceLevel: "evidence_reviewed",
    price: { amountAtomic: "300000", currency: "USDC", decimals: 6 },
    publishedDaysAgo: 21,
  },

  // 2. Webhook family: deliberate near-miss. Backlog without duplicate event IDs.
  {
    key: "slow-consumer-backlog-after-deploy",
    family: "webhook_idempotency",
    contributorSlug: "juniper",
    publicTitle: "Queue backlog after a deploy from a slow consumer (no duplicates)",
    publicSummary:
      "After a deploy, a queue consumer became much slower because of an unindexed lookup, and the backlog grew. Restarting workers helped briefly. No duplicate events were involved.",
    systemCategories: ["Deployment & CI/CD", "Logging & monitoring"],
    environment: ["Message queue", "Worker pool", "Relational database"],
    clues: [
      {
        id: "backlog-after-deploy",
        label: "Queue backlog grows right after a deploy",
        terms: ["queue backlog", "backlog", "queue congestion", "after deploy", "consumer lag"],
        weight: "key",
      },
      {
        id: "restart-helps-briefly",
        label: "Restarting workers helps briefly, then the backlog returns",
        terms: ["restart workers", "worker restart", "backlog returns", "queue refills"],
        weight: "supporting",
      },
      {
        id: "slow-handler",
        label: "Per-message processing time jumped",
        terms: ["slow consumer", "slow query", "processing time", "high latency", "missing index"],
        weight: "key",
      },
    ],
    mismatchSignals: [
      {
        id: "duplicate-event-ids",
        label: "The same event ID produces more than one job",
        terms: ["same event id", "duplicate jobs", "duplicate orders", "processed twice", "duplicate webhook"],
        explanation:
          "This guide is not about duplicate delivery. If one event creates multiple jobs, look at webhook idempotency guides instead; a slow consumer alone does not create duplicates.",
      },
      {
        id: "no-recent-deploy",
        label: "No deploy or schema change preceded the backlog",
        terms: ["no deploy", "traffic spike", "seasonal load"],
        explanation: "Without a change that slowed the consumer, the backlog is more likely a capacity or traffic issue.",
      },
    ],
    checksBeforeUse: [
      "Confirm there are no duplicate event IDs among queued or processed jobs.",
      "Compare per-message processing time before and after the deploy.",
      "Check whether the deploy added a query or call on the hot path.",
    ],
    evidenceScope: "Contributor's account only. No independent check is claimed.",
    sections: {
      recognize:
        "- Queue depth climbs steadily after a deploy while incoming volume is unchanged.\n" +
        "- Restarting workers drains a little, then the backlog returns.\n" +
        "- Every job is unique; no event ID appears twice.",
      check:
        "- Compare per-message processing time across the deploy boundary.\n" +
        "- Review the deploy diff for new database lookups or external calls in the consumer.\n" +
        "- Check slow-query logs for lookups on unindexed columns.",
      contain:
        "- Roll back the consumer change or put the new code path behind a flag.\n" +
        "- Temporarily add workers only if the database can handle the extra load.",
      recover:
        "- Add the missing index or move the lookup out of the per-message path.\n" +
        "- Let the backlog drain and watch consumer lag return to normal.",
      verify:
        "- Confirm per-message processing time is back to its pre-deploy level.\n" +
        "- Confirm queue depth stays flat under normal incoming volume.",
      limitations:
        "- This is not a duplicate-delivery problem; it does not help if the same event creates multiple jobs.\n" +
        "- Based on one contributor's environment; the slow path in your system may differ.",
    },
    failedAttempts:
      "- Restarting workers gave short relief but did not change processing time, so the backlog came back.\n" +
      "- Doubling the worker count increased database contention and made each message slower.",
    evidenceLevel: "contributor_reported",
    price: { amountAtomic: "100000", currency: "USDC", decimals: 6 },
    publishedDaysAgo: 9,
  },

  // 3. Tenant export authorization: DEEP guide.
  {
    key: "tenant-export-missing-authz",
    family: "tenant_export_authz",
    contributorSlug: "juniper",
    publicTitle: "Users could download another workspace's export (missing tenant check)",
    publicSummary:
      "A multi-tenant app checked that a user was signed in but not that a requested export belonged to their workspace. The fix scopes every export lookup to the caller's tenant.",
    systemCategories: ["Identity & access", "Cloud storage"],
    environment: ["Multi-tenant web app", "Export service", "Object storage", "Session-based auth"],
    clues: [
      {
        id: "foreign-export",
        label: "A user can open an export that belongs to another workspace",
        terms: ["wrong tenant", "other workspace", "cross tenant", "another customer's data", "data leak", "export download", "tenant isolation"],
        weight: "key",
      },
      {
        id: "authn-only",
        label: "Export endpoint checks sign-in but not ownership",
        terms: ["authorization", "authz", "access control", "ownership check", "idor", "missing permission check", "broken access control"],
        weight: "key",
      },
      {
        id: "guessable-id",
        label: "Export IDs are sequential or easy to enumerate",
        terms: ["sequential id", "guessable id", "enumerate", "incrementing id"],
        weight: "supporting",
      },
      {
        id: "audit-mismatch",
        label: "Access logs show export reads where the reader's tenant differs from the export's tenant",
        terms: ["audit log", "access log", "tenant mismatch"],
        weight: "supporting",
      },
    ],
    mismatchSignals: [
      {
        id: "stale-cache-only",
        label: "Only seen through a stale browser or CDN cache",
        terms: ["cdn cache", "browser cache", "stale cache", "cached page", "cache"],
        explanation:
          "Seeing another user's data through a stale browser or CDN cache does not by itself establish an authorization bug. Reproduce with a fresh, uncached request as a user from a different tenant before applying this guide.",
      },
      {
        id: "shared-workspace",
        label: "Both users legitimately share a workspace or have admin roles",
        terms: ["shared workspace", "admin role", "support access", "impersonation"],
        explanation: "Access that the permission model intends (shared membership, support tooling) is a policy question, not a missing check.",
      },
    ],
    checksBeforeUse: [
      "Reproduce with a fresh request (no cache) as a signed-in user from tenant A requesting a tenant B export in a test environment.",
      "Confirm the export lookup does not filter by the caller's tenant.",
      "Check access logs for reads where reader tenant and export tenant differ.",
      "List every endpoint that returns exports or export download links.",
    ],
    evidenceScope:
      "Reproduced in a toy multi-tenant app: before the fix, tenant A could read tenant B's export; after the fix, tenant A reads its own export and is denied tenant B's. Not tested on buyer systems.",
    sections: {
      recognize:
        "- A user reports seeing an export that contains another workspace's records.\n" +
        "- The export endpoint requires sign-in, but the lookup is by export ID alone.\n" +
        "- Export IDs are sequential or otherwise easy to guess.\n" +
        "- Access logs show export reads where the reader's tenant differs from the export's tenant.",
      check:
        "- In a test environment, sign in as a tenant A user and request a known tenant B export ID with no cache.\n" +
        "- Read the export handler and confirm whether the query filters by the caller's tenant.\n" +
        "- Search for other export paths (download links, signed URLs, background email delivery) that skip the same check.\n" +
        "- Query access logs for cross-tenant reads to estimate exposure.",
      contain:
        "- Temporarily require an ownership check at the export handler, or disable export download until it is fixed.\n" +
        "- Expire outstanding export download links so old links cannot be reused.\n" +
        "- Preserve access logs for the affected period before any rotation.",
      recover:
        "- Add tenant-scoped authorization to every export lookup: fetch by export ID AND the caller's tenant, and return not-found otherwise.\n" +
        "- Centralize the check in a shared data-access helper so new endpoints inherit it.\n" +
        "- Replace sequential export IDs with random identifiers as defence in depth, not as the fix.\n" +
        "- Follow your incident and notification process for any confirmed cross-tenant reads.",
      verify:
        "- Confirm a tenant A user can still read tenant A's own export.\n" +
        "- Confirm the same tenant A user is denied tenant B's export, including via download links.\n" +
        "- Do not accept 'all requests denied' as success; legitimate same-tenant access must keep working.\n" +
        "- Add an automated test that covers both the allowed and the denied case.",
      limitations:
        "- Applies when the root cause is a missing ownership check; it does not address cache-key or CDN leaks.\n" +
        "- The toy app used session-based auth with a single tenant per user; multi-workspace users need a per-request tenant context.\n" +
        "- Does not determine legal or contractual notification duties.",
    },
    failedAttempts:
      "- Switching to random export IDs made enumeration harder but left the missing check in place, so any shared or leaked link still worked across tenants.\n" +
      "- Adding the check only to the main export page missed the download-link endpoint, which used a separate lookup.\n" +
      "- A first fix denied all exports for users with multiple workspaces, which passed the cross-tenant test but broke legitimate access.",
    evidenceLevel: "test_reproduced",
    price: { amountAtomic: "600000", currency: "USDC", decimals: 6 },
    toyCase: "tenant",
    publishedDaysAgo: 14,
  },

  // 4. Tenant family: mismatch counterpart (CDN cache key missing auth vary).
  {
    key: "cdn-cache-served-other-dashboard",
    family: "tenant_export_authz",
    contributorSlug: "cobalt",
    publicTitle: "Shared CDN cache served one user's dashboard to another",
    publicSummary:
      "A CDN cached a personalized dashboard response because the cache key ignored the user's session, so some users briefly saw someone else's dashboard. The application's authorization checks were correct.",
    systemCategories: ["Network edge", "Identity & access"],
    environment: ["CDN", "Web app with personalized pages", "Session cookies"],
    clues: [
      {
        id: "other-users-dashboard",
        label: "Users briefly see another user's dashboard",
        terms: ["wrong dashboard", "another user's data", "someone else's account", "data leak", "wrong user"],
        weight: "key",
      },
      {
        id: "cache-hit",
        label: "Affected responses were served from the CDN cache",
        terms: ["cdn cache", "cache hit", "cached response", "shared cache", "edge cache"],
        weight: "key",
      },
      {
        id: "config-change",
        label: "Started after a CDN or caching rule change",
        terms: ["cache rule", "cdn config", "cache key", "vary header", "cache-control"],
        weight: "supporting",
      },
    ],
    mismatchSignals: [
      {
        id: "uncached-repro",
        label: "Reproducible with a fresh, uncached request",
        terms: ["no cache", "uncached", "direct to origin", "bypass cache", "cache miss"],
        explanation:
          "If the wrong data appears on uncached requests straight to the origin, the cause is likely a missing authorization check in the application, not caching.",
      },
      {
        id: "export-files",
        label: "Leak involves stored exports or files fetched by ID",
        terms: ["export", "download", "file id", "object storage"],
        explanation: "Lookups by object ID that skip tenant checks are an authorization bug; see tenant authorization guides.",
      },
    ],
    checksBeforeUse: [
      "Check response headers on affected pages for cache status and cache-control values.",
      "Try the same request directly against the origin with caching bypassed.",
      "Review recent CDN or caching rule changes.",
    ],
    evidenceScope: "Contributor's account; a reviewer inspected redacted CDN configuration and response headers. Not reproduced.",
    sections: {
      recognize:
        "- A few users report seeing someone else's name or data on their dashboard.\n" +
        "- Affected responses show a CDN cache hit.\n" +
        "- The issue started after a caching rule change.",
      check:
        "- Compare responses with caching bypassed versus through the CDN.\n" +
        "- Inspect the cache key configuration for personalized paths.\n" +
        "- Confirm personalized responses send cache-control values that forbid shared caching.",
      contain:
        "- Purge the CDN cache for personalized paths.\n" +
        "- Add a rule that bypasses the shared cache for authenticated requests.",
      recover:
        "- Mark personalized responses as private or no-store at the origin.\n" +
        "- Restrict CDN caching to explicitly public paths.\n" +
        "- Review edge logs to estimate which sessions received another user's page.",
      verify:
        "- Sign in as two different test users and confirm each sees only their own dashboard through the CDN.\n" +
        "- Confirm public pages are still cached as intended.",
      limitations:
        "- Applies to shared-cache leaks only; it does not fix a missing authorization check in the application.\n" +
        "- CDN configuration options differ by vendor; equivalent settings may have different names.",
    },
    failedAttempts:
      "- Purging the cache fixed it for a few minutes until the next personalized response was cached again.\n" +
      "- Shortening cache lifetime reduced exposure but did not remove it.",
    evidenceLevel: "evidence_reviewed",
    price: { amountAtomic: "250000", currency: "USDC", decimals: 6 },
    publishedDaysAgo: 33,
  },

  // 5. Signing key cache: DEEP guide.
  {
    key: "signing-key-rotation-stale-cache",
    family: "signing_key_cache",
    contributorSlug: "cobalt",
    publicTitle: "Valid signed events rejected after provider key rotation (stale key cache)",
    publicSummary:
      "After a provider rotated its signing keys, a service rejected valid signed events because its key cache did not refresh as the provider documents. The fix refreshes on unknown key ID, with a rate limit, and respects cache headers. Signature verification stays on.",
    systemCategories: ["Authentication service", "Identity & access"],
    environment: ["Signed webhook or token consumer", "Published key set endpoint", "In-process key cache"],
    clues: [
      {
        id: "valid-events-rejected",
        label: "Valid signed events suddenly fail verification",
        terms: ["signature verification failed", "invalid signature", "signature failure", "rejected webhook", "401", "verification error"],
        weight: "key",
      },
      {
        id: "unknown-kid",
        label: "Errors report an unknown key ID rather than a signature mismatch",
        terms: ["unknown kid", "key id not found", "kid", "no matching key", "key not found"],
        weight: "key",
      },
      {
        id: "after-rotation",
        label: "Failures start around a provider key rotation",
        terms: ["key rotation", "rotated keys", "jwks", "signing key", "new key"],
        weight: "key",
      },
      {
        id: "restart-fixes",
        label: "Restarting the service makes it work again",
        terms: ["restart fixes", "works after restart", "stale cache", "key cache"],
        weight: "supporting",
      },
    ],
    mismatchSignals: [
      {
        id: "signature-mismatch",
        label: "Key ID is known but the signature does not match",
        terms: ["signature mismatch", "bad signature", "tampered", "wrong secret"],
        explanation:
          "A known key ID with a failing signature points to a wrong secret, altered payload, or encoding issue, not a stale cache. Those events should stay rejected.",
      },
      {
        id: "clock-skew",
        label: "Errors mention expiry or not-before times",
        terms: ["token expired", "nbf", "clock skew", "iat in future"],
        explanation: "Time-based failures usually come from clock drift on a host; see clock-skew guides.",
      },
    ],
    checksBeforeUse: [
      "Confirm failing events carry a key ID that is missing from your cached key set.",
      "Confirm the provider published new keys around the time failures started.",
      "Check how and when your service refreshes its key cache, and whether it reads cache headers.",
      "Confirm events with known key IDs and bad signatures are still rejected.",
    ],
    evidenceScope:
      "Reproduced in a toy key-cache service: before the fix, events signed with a rotated key were rejected; after the fix, they are accepted while events with invalid signatures are still rejected. Not tested on buyer systems.",
    sections: {
      recognize:
        "- Signed events or tokens that were accepted yesterday now fail verification.\n" +
        "- Error details mention an unknown or missing key ID.\n" +
        "- Failures begin around the provider's announced or observed key rotation.\n" +
        "- Restarting the service temporarily fixes it because the cache is reloaded.",
      check:
        "- Log the key ID from failing events and compare it to the key IDs in your cached key set.\n" +
        "- Fetch the provider's current published key set and confirm the new key ID is present.\n" +
        "- Separate failures into 'unknown key ID' and 'signature mismatch'; only the first is a cache issue.\n" +
        "- Read the provider's documentation on rotation overlap and cache lifetime.",
      contain:
        "- Keep signature verification enabled; never disable it or accept unsigned events as a workaround.\n" +
        "- Trigger a one-off key set refresh to restore acceptance of valid events.\n" +
        "- If the provider supports redelivery, queue rejected events for replay after the refresh.",
      recover:
        "- On an unknown key ID, refresh the key set once and retry verification against the refreshed keys.\n" +
        "- Rate-limit refreshes so a flood of bad key IDs cannot hammer the provider's key endpoint.\n" +
        "- Respect the cache-control lifetime the provider sends for the key set instead of a fixed long cache.\n" +
        "- Replay or request redelivery of valid events rejected during the window.",
      verify:
        "- Confirm events signed with the new key are accepted.\n" +
        "- Confirm events with a known key ID and an invalid signature are still rejected.\n" +
        "- Confirm events with a random unknown key ID are rejected and trigger at most one rate-limited refresh.\n" +
        "- Monitor the ratio of unknown-key-ID errors after the next rotation.",
      limitations:
        "- Applies when failures are caused by a stale key cache; it does not explain genuine signature mismatches.\n" +
        "- The toy service used one provider's published key set format; others may differ in headers and rotation overlap.\n" +
        "- Rate-limit thresholds need tuning for your traffic.",
    },
    failedAttempts:
      "- Restarting the service fixed acceptance until the next rotation, because the cache still only loaded at startup.\n" +
      "- Shortening the fixed cache lifetime to a few minutes caused heavy load on the key endpoint and still left a gap after rotation.\n" +
      "- Refreshing on every verification failure let invalid traffic trigger unlimited refreshes until a rate limit was added.",
    evidenceLevel: "test_reproduced",
    price: { amountAtomic: "450000", currency: "USDC", decimals: 6 },
    toyCase: "keycache",
    publishedDaysAgo: 6,
  },

  // 6. Signing family: clock skew on one host.
  {
    key: "token-validation-clock-skew",
    family: "signing_key_cache",
    contributorSlug: "juniper",
    publicTitle: "Token validation failures from clock skew on one host",
    publicSummary:
      "One application host's clock drifted, so it rejected valid tokens as expired or not yet valid while other hosts accepted them.",
    systemCategories: ["Authentication service", "Logging & monitoring"],
    environment: ["Load-balanced app hosts", "Signed access tokens", "Time sync service"],
    clues: [
      {
        id: "one-host-fails",
        label: "Failures come from only one host behind the load balancer",
        terms: ["one host", "single node", "intermittent 401", "random logout", "some requests fail"],
        weight: "key",
      },
      {
        id: "time-errors",
        label: "Errors mention expired or not-yet-valid tokens",
        terms: ["token expired", "not yet valid", "nbf", "iat", "clock skew", "time drift"],
        weight: "key",
      },
      {
        id: "ntp-issue",
        label: "Time sync on the host is stopped or misconfigured",
        terms: ["ntp", "time sync", "clock drift", "chrony"],
        weight: "supporting",
      },
    ],
    mismatchSignals: [
      {
        id: "unknown-key",
        label: "Errors report an unknown key ID",
        terms: ["unknown kid", "key not found", "key rotation"],
        explanation: "Unknown key IDs point to a stale key cache after rotation, not clock skew.",
      },
      {
        id: "all-hosts",
        label: "Every host fails equally",
        terms: ["all hosts", "every request", "all nodes"],
        explanation: "Skew on one host shows up as partial failures; uniform failures suggest a config or key problem.",
      },
    ],
    checksBeforeUse: [
      "Group failures by host and confirm they concentrate on one or a few.",
      "Compare the failing host's clock with a trusted time source.",
      "Confirm error messages concern expiry or not-before claims.",
    ],
    evidenceScope: "Contributor's account only. No independent check is claimed.",
    sections: {
      recognize:
        "- Users are intermittently signed out or see auth errors on some requests.\n" +
        "- Failures concentrate on a single host.\n" +
        "- Errors say tokens are expired or not yet valid.",
      check:
        "- Group auth failures by host.\n" +
        "- Compare the host's clock with a trusted time source.\n" +
        "- Check whether the time sync service is running on that host.",
      contain:
        "- Remove the drifting host from the load balancer.\n" +
        "- Keep token validation strict; do not widen allowed skew to hide the problem.",
      recover:
        "- Restart or fix time sync on the host and confirm the clock converges.\n" +
        "- Return the host to the pool once its clock matches.\n" +
        "- Add monitoring for clock offset on every host.",
      verify:
        "- Confirm valid tokens are accepted on the repaired host.\n" +
        "- Confirm expired tokens are still rejected.",
      limitations:
        "- Applies to time-based validation failures on a subset of hosts.\n" +
        "- Based on one contributor's environment; no independent check.",
    },
    failedAttempts:
      "- Raising the allowed clock tolerance masked the errors but weakened expiry checks across all hosts.\n" +
      "- Rotating signing keys had no effect because the keys were never the problem.",
    evidenceLevel: "contributor_reported",
    price: { amountAtomic: "150000", currency: "USDC", decimals: 6 },
    publishedDaysAgo: 47,
  },
];
