// Apify adapter: runs an Actor against a short allowlist of public advisory pages only.
// User-submitted URLs are never crawled.
import { z } from "zod";

export const ALLOWED_HOSTS = new Set(["cheatsheetseries.owasp.org", "pages.nist.gov", "www.cisa.gov"]);

const SOURCES: { url: string; title: string; sourceName: string; note: string; categories: string[] }[] = [
  {
    url: "https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html",
    title: "Authentication Cheat Sheet",
    sourceName: "OWASP Cheat Sheet Series",
    note: "Covers account lockout, throttling, and logging of failed authentication attempts.",
    categories: ["Identity & access", "Authentication service"],
  },
  {
    url: "https://pages.nist.gov/800-63-3/sp800-63b.html",
    title: "NIST SP 800-63B: Digital Identity Guidelines — Authentication and Lifecycle Management",
    sourceName: "NIST",
    note: "Includes guidance on rate-limiting failed authentication attempts.",
    categories: ["Identity & access", "Authentication service"],
  },
  {
    url: "https://cheatsheetseries.owasp.org/cheatsheets/Credential_Stuffing_Prevention_Cheat_Sheet.html",
    title: "Credential Stuffing Prevention Cheat Sheet",
    sourceName: "OWASP Cheat Sheet Series",
    note: "Defensive controls for detecting and slowing repeated automated login attempts.",
    categories: ["Authentication service"],
  },
  {
    url: "https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html",
    title: "Logging Cheat Sheet",
    sourceName: "OWASP Cheat Sheet Series",
    note: "What security events to log and how to make them useful for detection.",
    categories: ["Logging & monitoring", "Deployment & CI/CD"],
  },
  {
    url: "https://www.cisa.gov/news-events/cybersecurity-advisories",
    title: "Cybersecurity Alerts & Advisories",
    sourceName: "CISA",
    note: "Index of current public advisories from the U.S. Cybersecurity and Infrastructure Security Agency.",
    categories: [],
  },
];

export function allowlistedSourcesFor(categories: string[]) {
  const matches = SOURCES.filter((s) => s.categories.some((c) => categories.includes(c)));
  return (matches.length ? matches : SOURCES.filter((s) => s.categories.length === 0)).slice(0, 3);
}

/** Curated fallback used when Apify is not configured or fails. Always stored with seeded=true. */
export function seededReferencesFor(categories: string[]): FetchedReference[] {
  return allowlistedSourcesFor(categories).map((s) => ({ title: s.title, url: s.url, sourceName: s.sourceName, relevanceNote: s.note }));
}

const itemSchema = z.object({
  url: z.string().url(),
  metadata: z.object({ title: z.string().optional() }).passthrough().optional(),
  text: z.string().optional(),
});

export type FetchedReference = { title: string; url: string; sourceName: string; relevanceNote: string };

export async function fetchWithApify(token: string, actorId: string, categories: string[]): Promise<FetchedReference[]> {
  const sources = allowlistedSourcesFor(categories);
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
      });
    }
    if (out.length === 0) throw new Error("Apify returned no allowlisted pages");
    return out;
  } finally {
    clearTimeout(timer);
  }
}
