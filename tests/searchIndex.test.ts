/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "../convex/_generated/api";
import schema from "../convex/schema";
import { MIN_SEMANTIC_SCORE, publicPreviewDoc, rankKey, sameDocs } from "../convex/lib/searchIndex";

const modules = import.meta.glob("../convex/**/*.*s");

async function seeded() {
  const t = convexTest(schema, modules);
  await t.mutation(api.demo.reset, { actor: "review-desk" });
  return t;
}

/** Statement-sized fragments of a text, long enough that a match is not a coincidence. */
const fragments = (s: string | undefined) =>
  (s ?? "")
    .split(/\n|(?<=\.)\s/)
    .map((l) => l.replace(/^\s*-\s*/, "").trim())
    .filter((l) => l.length >= 30);

describe("public-preview index documents", () => {
  it("contain only free preview fields", () => {
    const doc = publicPreviewDoc({
      _id: "pb1",
      revision: 2,
      publicTitle: "Title",
      publicSummary: "Summary",
      previewRecognize: "- sign",
      publicLimitations: "- limit",
      systemCategories: ["Cat"],
      environment: ["Env"],
      // Extra fields on a real row must be ignored.
      ...({ privateNotes: "SECRET-NOTE", check: "PAID-CHECK" } as object),
    } as never);
    expect(doc.text).not.toMatch(/SECRET-NOTE|PAID-CHECK/);
    expect(doc).toEqual({ id: "pb1", text: expect.stringContaining("Summary"), metadata: { revision: "2" } });
  });

  it("detects when the remote index is stale", () => {
    const d = { id: "a", text: "x", metadata: { revision: "1" } };
    expect(sameDocs([d], [d])).toBe(true);
    expect(sameDocs([{ ...d, metadata: { revision: "0" } }], [d])).toBe(false);
    expect(sameDocs([], [d])).toBe(false);
  });

  it("never include private draft notes or paid sections from the seeded catalog", async () => {
    const t = await seeded();
    const docs = await t.query(internal.searchIndex.publicIndexSource, {});
    const indexed = docs.map((d) => d.text).join("\n");
    const { drafts, paid } = await t.run(async (ctx) => ({
      drafts: await ctx.db.query("incidentDrafts").collect(),
      paid: await ctx.db.query("playbookRevisions").collect(),
    }));
    expect(docs.length).toBeGreaterThan(0);
    const forbidden = [
      ...drafts.flatMap((d) => [...fragments(d.privateNotes), ...fragments(d.evidenceSummary), ...(d.identifyingTerms ?? [])]),
      ...paid.flatMap((r) => [r.check, r.contain, r.recover, r.verify].flatMap(fragments)),
    ];
    expect(forbidden.length).toBeGreaterThan(10);
    for (const f of forbidden) expect(indexed, f).not.toContain(f);
  });
});

describe("semantic ranking", () => {
  it("drops weak semantic neighbours that have no clue overlap", () => {
    expect(rankKey(null, 0, MIN_SEMANTIC_SCORE - 0.01, true)).toBeNull();
    expect(rankKey(null, 0, 0.6, true)).not.toBeNull();
    expect(rankKey("strong_overlap", 5, undefined, true)).not.toBeNull();
    expect(rankKey(null, 0, 0.9, false)).toBeNull();
  });

  it("puts the Moss candidate first and keeps it without clue overlap", async () => {
    const t = await seeded();
    const query = "people get bounced at login, but only when their request lands on one particular server whose time drifted";
    const target = (await t.query(api.playbooks.search, { actor: "harbor", query: "" })).find((r) => /clock skew/i.test(r.publicTitle))!;
    const ranked = await t.query(internal.playbooks.searchRanked, { actor: "harbor", query, semantic: [{ id: target._id, score: 0.67 }] });
    expect(ranked[0]._id).toBe(target._id);
    expect(ranked[0].semanticScore).toBe(0.67);
  });

  it("falls back to labeled keyword matching when Moss is unavailable", async () => {
    const t = await seeded();
    const res = await t.action(api.semanticSearch.buyerSearch, { actor: "harbor", query: "identical webhook event IDs create two jobs" });
    expect(res.retrieval).toEqual({ engine: "keyword_fallback", fallbackReason: "Moss is not configured" });
    expect(res.results.length).toBeGreaterThan(0);
  });
});
