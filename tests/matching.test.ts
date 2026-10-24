import { describe, expect, it } from "vitest";
import { matchGuide, type MatchableGuide } from "../convex/lib/matching";
import { CATALOG, PRIMARY_DRAFT } from "../convex/lib/scenarios";
import { draftSectionsFallback } from "../convex/lib/drafting";
import { applyGeneralizations } from "../convex/lib/privacy";

// Published text is privacy-generalized first, exactly as in the app.
const gen = (t: string) => applyGeneralizations(t, PRIMARY_DRAFT.identifyingTerms, ["Northstar Cloud", "Northstar"]);

// Fixed-query retrieval evaluation over the seeded scenarios (a small fixture check, not proof of general accuracy).
const guides: (MatchableGuide & { key: string })[] = [
  {
    key: "primary-webhook",
    publicTitle: PRIMARY_DRAFT.publicTitle,
    publicSummary: gen(PRIMARY_DRAFT.sanitizedSummary),
    recognize: gen(draftSectionsFallback(PRIMARY_DRAFT).recognize.body),
    systemCategories: PRIMARY_DRAFT.systemCategories,
    environment: PRIMARY_DRAFT.environment,
    clues: PRIMARY_DRAFT.clues,
    mismatchSignals: PRIMARY_DRAFT.mismatchSignals,
  },
  ...CATALOG.map((g) => ({
    key: g.key,
    publicTitle: g.publicTitle,
    publicSummary: g.publicSummary,
    recognize: g.sections.recognize,
    systemCategories: g.systemCategories,
    environment: g.environment,
    clues: g.clues,
    mismatchSignals: g.mismatchSignals,
  })),
];

function rank(query: string) {
  return guides
    .map((g) => ({ key: g.key, m: matchGuide(query, g) }))
    .filter((r) => r.m)
    .sort((a, b) => b.m!.score - a.m!.score);
}

describe("fixed-query retrieval evaluation", () => {
  it("exact wording finds the primary case with strong overlap", () => {
    const r = rank("The queue fills again after restarting workers, and identical webhook event IDs create two jobs");
    expect(r[0].key).toBe("primary-webhook");
    expect(r[0].m!.relevanceLabel).toBe("strong_overlap");
  });
  it("paraphrase still finds the primary case", () => {
    const r = rank("provider keeps retrying the same delivery and we get duplicate job records");
    expect(r[0].key).toBe("primary-webhook");
  });
  it("queue backlog WITHOUT repeated event IDs is not a confident primary match", () => {
    const r = rank("queue backlog after deploy without repeated event IDs");
    const primary = r.find((x) => x.key === "primary-webhook");
    expect(primary?.m!.relevanceLabel ?? "none").not.toBe("strong_overlap");
    expect(r[0].key).toBe("slow-consumer-backlog-after-deploy");
  });
  it("secondary security case: cross-tenant export", () => {
    const r = rank("A signed-in customer can see export data outside their workspace");
    expect(r[0].key).toBe("tenant-export-missing-authz");
    expect(r[0].m!.relevanceLabel).not.toBe("needs_evidence");
  });
  it("wrong environment / mismatch signal is flagged", () => {
    const r = rank("duplicate jobs but each duplicate has a different event id");
    const primary = r.find((x) => x.key === "primary-webhook");
    expect(primary?.m!.conflictingClues.length ?? 0).toBeGreaterThan(0);
    expect(primary?.m!.relevanceLabel).toBe("needs_evidence");
  });
  it("third case: signing key rotation", () => {
    const r = rank("valid signed events rejected after the provider rotated keys, errors mention unknown kid");
    expect(r[0].key).toBe("signing-key-rotation-stale-cache");
  });
  it("unrelated query returns nothing", () => {
    expect(rank("how do I bake sourdough bread")).toEqual([]);
  });
  it("private identifier from the draft's notes is not publicly matchable", () => {
    expect(rank("demo-client-42")).toEqual([]);
    expect(rank("hooks.internal.northstar.example")).toEqual([]);
  });
});
