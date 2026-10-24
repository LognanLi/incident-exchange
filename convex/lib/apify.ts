// Apify adapter: runs an Actor against a short allowlist of public advisory pages only.
// User-submitted URLs are never crawled.
import { z } from "zod";

export const ALLOWED_HOSTS = new Set([
  "docs.stripe.com",
  "docs.github.com",
  "cheatsheetseries.owasp.org",
  "owasp.org",
  "auth0.com",
  "www.rfc-editor.org",
]);

export type SourceFamily = "webhook" | "tenant" | "keycache" | "general";
export type SourceType = "provider_docs" | "security_guidance" | "advisory_index";

/** Allowlisted public pages per incident family. Public context is free and never sold as a contributor's fix. */
const SOURCES: { url: string; title: string; sourceName: string; note: string; family: SourceFamily; sourceType: SourceType }[] = [
  { url: "https://docs.stripe.com/webhooks", title: "Receive Stripe events in your webhook endpoint", sourceName: "Stripe Docs", note: "Provider guidance on retries and handling duplicate webhook events.", family: "webhook", sourceType: "provider_docs" },
  { url: "https://docs.github.com/en/webhooks/using-webhooks/best-practices-for-using-webhooks", title: "Best practices for using webhooks", sourceName: "GitHub Docs", note: "Respond quickly, process asynchronously, and use delivery IDs to protect against replays.", family: "webhook", sourceType: "provider_docs" },
  { url: "https://docs.stripe.com/api/idempotent_requests", title: "Idempotent requests", sourceName: "Stripe API Reference", note: "How idempotency keys make client retries safe — relevant to the related client-retry case.", family: "webhook", sourceType: "provider_docs" },
  { url: "https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html", title: "Authorization Cheat Sheet", sourceName: "OWASP Cheat Sheet Series", note: "Enforce authorization on every request, deny by default, and test it.", family: "tenant", sourceType: "security_guidance" },
  { url: "https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/", title: "API1:2023 Broken Object Level Authorization", sourceName: "OWASP API Security Top 10", note: "Object-level checks: verify the caller may access the specific record requested.", family: "tenant", sourceType: "security_guidance" },
  { url: "https://auth0.com/docs/get-started/tenant-settings/signing-keys/rotate-signing-keys", title: "Rotate Signing Keys", sourceName: "Auth0 Docs", note: "Provider documentation on signing-key rotation and what relying services must handle.", family: "keycache", sourceType: "provider_docs" },
  { url: "https://www.rfc-editor.org/rfc/rfc7517", title: "RFC 7517: JSON Web Key (JWK)", sourceName: "IETF RFC Editor", note: "Defines key IDs (kid) and key sets used to select verification keys.", family: "keycache", sourceType: "security_guidance" },
  { url: "https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html", title: "Logging Cheat Sheet", sourceName: "OWASP Cheat Sheet Series", note: "What to log so incidents can be investigated.", family: "general", sourceType: "security_guidance" },
];

export function allowlistedSourcesFor(family: SourceFamily) {
  const matches = SOURCES.filter((s) => s.family === family);
  return (matches.length ? matches : SOURCES.filter((s) => s.family === "general")).slice(0, 3);
}

/** Curated fallback used when Apify is not configured or fails. Always stored with seeded=true. */
export function seededReferencesFor(family: SourceFamily): FetchedReference[] {
  return allowlistedSourcesFor(family).map((s) => ({ title: s.title, url: s.url, sourceName: s.sourceName, relevanceNote: s.note, sourceType: s.sourceType }));
}

const itemSchema = z.object({
  url: z.string().url(),
  metadata: z.object({ title: z.string().optional() }).passthrough().optional(),
  text: z.string().optional(),
});

export type FetchedReference = { title: string; url: string; sourceName: string; relevanceNote: string; sourceType: SourceType; excerpt?: string };

export async function fetchWithApify(token: string, actorId: string, family: SourceFamily): Promise<FetchedReference[]> {
  const sources = allowlistedSourcesFor(family);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items?timeout=110&memory=1024`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          startUrls: sources.map((s) => ({ url: s.url })),
          maxCrawlDepth: 0,
          maxRequestRetries: 1,
          maxCrawlPages: sources.length,
          crawlerType: "cheerio",
        }),
        signal: controller.signal,
      },
    );
    if (res.status === 429) throw new Error("Apify rate limit reached");
    if (!res.ok) throw new Error(`Apify responded with HTTP ${res.status}`);
    const parsed = z.array(itemSchema).safeParse(await res.json());
    if (!parsed.success) throw new Error("Unexpected Apify response shape");
    const out: FetchedReference[] = [];
    for (const item of parsed.data) {
      const host = new URL(item.url).host;
      if (!ALLOWED_HOSTS.has(host)) continue; // defense in depth: drop anything off-allowlist
      const src = sources.find((s) => s.url === item.url) ?? sources.find((s) => new URL(s.url).host === host);
      out.push({
        title: (item.metadata?.title ?? src?.title ?? item.url).slice(0, 200),
        url: item.url,
        sourceName: src?.sourceName ?? host,
        relevanceNote: src?.note ?? "Allowlisted public guidance.",
        sourceType: src?.sourceType ?? "security_guidance",
        // Short attributed excerpt only; full articles are never stored or resold.
        excerpt: item.text ? item.text.replace(/\s+/g, " ").trim().slice(0, 280) : undefined,
      });
    }
    if (out.length === 0) throw new Error("Apify returned no allowlisted pages");
    return out;
  } finally {
    clearTimeout(timer);
  }
}
