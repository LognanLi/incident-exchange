import { describe, expect, it } from "vitest";
import { MossError, parseCitedAnswer, parseDraftResponse, playbookDocuments, playbookIndexName } from "../convex/lib/moss";
import { NOT_ENOUGH_INFO } from "../convex/lib/qa";

describe("Moss draft parsing", () => {
  const good = { recognize: ["a"], check: [], contain: ["b"], recover: [], verify: ["c"], limitations: [] };
  it("accepts the six-section JSON shape (also inside code fences)", () => {
    expect(parseDraftResponse(JSON.stringify(good)).verify).toEqual(["c"]);
    expect(parseDraftResponse("```json\n" + JSON.stringify(good) + "\n```").recognize).toEqual(["a"]);
  });
  it("rejects invalid, mis-shaped, or empty drafts", () => {
    expect(() => parseDraftResponse("not json")).toThrow(MossError);
    expect(() => parseDraftResponse(JSON.stringify({ recognize: ["a"] }))).toThrow(MossError);
    expect(() => parseDraftResponse(JSON.stringify({ ...good, recognize: [], contain: [], verify: [] }))).toThrow(MossError);
  });
});

describe("Moss Q&A citation parsing", () => {
  it("keeps only citations to sections the viewer may read", () => {
    const r = parseCitedAnswer("Run the lockout test [Verify]. Restore the threshold [Recover].", ["recognize", "limitations"]);
    expect(r.citations).toEqual([]);
    expect(r.grounded).toBe(false);
    const ok = parseCitedAnswer("Run the lockout test [Verify].", ["verify"]);
    expect(ok.citations.map((c) => c.section)).toEqual(["verify"]);
    expect(ok.grounded).toBe(true);
  });
  it("normalizes not-enough-information replies", () => {
    expect(parseCitedAnswer(NOT_ENOUGH_INFO, ["verify"])).toEqual({ answer: NOT_ENOUGH_INFO, citations: [], grounded: false });
    expect(parseCitedAnswer("", ["verify"]).grounded).toBe(false);
  });
});

describe("Moss index documents", () => {
  it("tags every statement with its section and skips missing sections", () => {
    const docs = playbookDocuments({ recognize: "- one\n- two", limitations: "- three" });
    expect(docs.map((d) => d.text)).toEqual(["[Recognize] one", "[Recognize] two", "[Limitations] three"]);
    expect(docs.every((d) => d.metadata.section)).toBe(true);
  });
  it("produces index names the cleanup allowlist accepts", () => {
    expect(playbookIndexName("JN7ex0abc", "preview")).toMatch(/^ix-[a-z0-9]+-(preview|full)$/);
  });
});
