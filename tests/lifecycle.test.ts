/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";
import type { Id } from "../convex/_generated/dataModel";

const modules = import.meta.glob("../convex/**/*.*s");

const CHECKLIST = {
  sixSectionsComplete: true,
  noSensitiveData: true,
  defensiveOnly: true,
  evidenceSupportsLabel: true,
  limitationsStated: true,
};

async function seeded() {
  const t = convexTest(schema, modules);
  await t.mutation(api.demo.reset, {});
  const mine = await t.query(api.drafts.listMine, { actor: "northstar" });
  return { t, draftId: mine.drafts[0]._id };
}

async function prepareAndSubmit(t: ReturnType<typeof convexTest>, draftId: Id<"incidentDrafts">) {
  await t.mutation(api.drafts.generateSections, { actor: "northstar", draftId });
  await t.mutation(api.drafts.acceptAllSections, { actor: "northstar", draftId });
  await t.mutation(api.drafts.applyGeneralizationsToDraft, { actor: "northstar", draftId });
  await t.mutation(api.drafts.approveAndSubmit, { actor: "northstar", draftId, confirmed: true });
}

describe("contributor → reviewer → buyer lifecycle", () => {
  it("runs the full seeded demo end to end", async () => {
    const { t, draftId } = await seeded();

    // Contributor: draft (fallback), scan flags identifiers, cannot submit until resolved.
    await t.mutation(api.drafts.generateSections, { actor: "northstar", draftId });
    await t.mutation(api.drafts.acceptAllSections, { actor: "northstar", draftId });
    const scan = await t.mutation(api.drafts.runPrivacyScan, { actor: "northstar", draftId });
    expect(scan.high).toBeGreaterThan(0);
    await expect(t.mutation(api.drafts.approveAndSubmit, { actor: "northstar", draftId, confirmed: true })).rejects.toThrow(
      /privacy/i,
    );
    await t.mutation(api.drafts.applyGeneralizationsToDraft, { actor: "northstar", draftId });
    const afterFix = await t.query(api.drafts.getMine, { actor: "northstar", draftId });
    expect(afterFix.draft.privacyFindings.filter((f) => f.severity === "high")).toEqual([]);
    expect(afterFix.blockers).toEqual([]);
    await t.mutation(api.drafts.approveAndSubmit, { actor: "northstar", draftId, confirmed: true });

    // Reviewer: "test reproduced" is refused until a real before/fix/after sequence exists.
    await expect(
      t.mutation(api.reviews.decide, { actor: "review-desk", draftId, decision: "approve", note: "", evidenceLevel: "test_reproduced", checklist: CHECKLIST }),
    ).rejects.toThrow(/Test reproduced/);
    const before = await t.mutation(api.validation.runCheck, { actor: "review-desk", draftId, step: "before" });
    expect(before.passed).toBe(false);
    await t.mutation(api.validation.applyFix, { actor: "review-desk", draftId });
    const after = await t.mutation(api.validation.runCheck, { actor: "review-desk", draftId, step: "after" });
    expect(after.passed).toBe(true);
    await t.action(api.references.fetchReferences, { actor: "review-desk", draftId });
    await t.mutation(api.reviews.decide, { actor: "review-desk", draftId, decision: "approve", note: "Looks good.", evidenceLevel: "test_reproduced", checklist: CHECKLIST });

    // Not searchable until the contributor's final approval.
    let results = await t.query(api.playbooks.search, { actor: "harbor", query: "The queue fills again after restarting workers, and identical webhook event IDs create two jobs" });
    expect(results.some((r) => r._id === undefined || r.publicTitle.includes("Northstar"))).toBe(false);
    const beforePublish = results.length;
    const playbookId = await t.mutation(api.drafts.publishFinal, { actor: "northstar", draftId, confirmed: true });

    const pb0Paid = "observed recovery sequence"; // phrase never present in public projections
    // Buyer: search finds it first with a reason; detail locked until simulated payment completes.
    results = await t.query(api.playbooks.search, { actor: "harbor", query: "The queue fills again after restarting workers, and identical webhook event IDs create two jobs" });
    expect(results.length).toBe(beforePublish + 1);
    expect(results[0]._id).toBe(playbookId);
    expect(results[0].match?.relevanceLabel).toBe("strong_overlap");
    expect(results[0].match?.matchedClues.length).toBeGreaterThan(0);
    expect(JSON.stringify(results)).not.toContain(pb0Paid);
    expect(results[0].evidenceLevel).toBe("test_reproduced");
    let pb = await t.query(api.playbooks.get, { actor: "harbor", playbookId });
    expect(pb!.lockedSteps).toBeNull();
    expect(pb!.references.length).toBeGreaterThanOrEqual(2);

    const purchaseId = await t.mutation(api.purchases.startCheckout, { actor: "harbor", playbookId });
    pb = await t.query(api.playbooks.get, { actor: "harbor", playbookId });
    expect(pb!.lockedSteps).toBeNull(); // pending is not paid
    await t.mutation(api.purchases.completeSimulated, { actor: "harbor", purchaseId, confirmed: true });
    pb = await t.query(api.playbooks.get, { actor: "harbor", playbookId });
    expect(pb!.lockedSteps?.verify.length).toBeGreaterThan(10);
    expect(pb!.failedAttempts?.length).toBeGreaterThan(10);

    const receipt = await t.query(api.purchases.get, { actor: "harbor", purchaseId });
    expect(receipt).toMatchObject({ amountAtomic: "500000", contributorShareAtomic: "400000", platformShareAtomic: "100000", paymentStatus: "simulated_success", provider: "demo_simulator", revision: 1 });
    // Retrying checkout after success returns the same purchase (no second charge / accrual).
    expect(await t.mutation(api.purchases.startCheckout, { actor: "harbor", playbookId })).toBe(purchaseId);

    const earnings = await t.query(api.drafts.listMine, { actor: "northstar" });
    expect(earnings.accruedAtomic).toBe("400000");
    expect(earnings.paidOutAtomic).toBe("0");

    // Feedback reaches the reviewer.
    await t.mutation(api.feedback.submit, { actor: "harbor", playbookId, relevance: "very_relevant", outcome: "resolved", notes: "" });
    const fb = await t.query(api.reviews.feedbackList, { actor: "review-desk" });
    expect(fb).toHaveLength(1);
    expect(fb[0].outcome).toBe("resolved");
  });

  it("supports request changes (back to editable) and reject, each with a required reason", async () => {
    const { t, draftId } = await seeded();
    await prepareAndSubmit(t, draftId);
    await expect(
      t.mutation(api.reviews.decide, { actor: "review-desk", draftId, decision: "request_changes", note: "  ", checklist: CHECKLIST }),
    ).rejects.toThrow(/reason/);
    await t.mutation(api.reviews.decide, { actor: "review-desk", draftId, decision: "request_changes", note: "Clarify the verify step.", checklist: CHECKLIST });
    let d = await t.query(api.drafts.getMine, { actor: "northstar", draftId });
    expect(d.draft.status).toBe("changes_requested");
    expect(d.draft.reviewerNote).toBe("Clarify the verify step.");
    // Editable again; resubmit, then reject.
    await t.mutation(api.drafts.updateSection, { actor: "northstar", draftId, key: "verify", body: "- Deliver the same synthetic event twice and confirm one job.", accepted: true });
    await t.mutation(api.drafts.runPrivacyScan, { actor: "northstar", draftId });
    await t.mutation(api.drafts.approveAndSubmit, { actor: "northstar", draftId, confirmed: true });
    await t.mutation(api.reviews.decide, { actor: "review-desk", draftId, decision: "reject", note: "Out of scope.", checklist: CHECKLIST });
    d = await t.query(api.drafts.getMine, { actor: "northstar", draftId });
    expect(d.draft.status).toBe("rejected");
    await expect(t.mutation(api.drafts.publishFinal, { actor: "northstar", draftId, confirmed: true })).rejects.toThrow();
  });

  it("creates and saves a new draft with validated input", async () => {
    const { t } = await seeded();
    const fields = {
      title: "New incident", privateNotes: "", evidenceSummary: "", symptoms: "Something broke.", detectionClues: "",
      attemptedActions: "", containmentSteps: "", recoverySteps: "", verificationSteps: "", limitations: "",
      identifyingTerms: [], publicTitle: "", sanitizedSummary: "", systemCategories: ["Network edge"], environment: [], failedAttempts: "",
      sharingLevel: "anonymous" as const, priceAtomic: "250000",
    };
    await expect(t.mutation(api.drafts.create, { actor: "northstar", fields: { ...fields, priceAtomic: "10" } })).rejects.toThrow(/[Pp]rice/);
    await expect(t.mutation(api.drafts.create, { actor: "northstar", fields: { ...fields, systemCategories: ["Bogus"] } })).rejects.toThrow(/category/);
    const id = await t.mutation(api.drafts.create, { actor: "northstar", fields });
    const d = await t.query(api.drafts.getMine, { actor: "northstar", draftId: id });
    expect(d.draft.status).toBe("draft");
    expect(d.orgAlias).toBe("Anonymous contributor");
  });

  it("reset restores the seeded state", async () => {
    const { t, draftId } = await seeded();
    await prepareAndSubmit(t, draftId);
    await t.mutation(api.demo.reset, {});
    const mine = await t.query(api.drafts.listMine, { actor: "northstar" });
    expect(mine.drafts).toHaveLength(1);
    expect(mine.drafts[0].status).toBe("draft");
    expect(mine.accruedAtomic).toBe("0");
  });
});

describe("access control", () => {
  it("never exposes private contributor notes to buyers", async () => {
    const { t, draftId } = await seeded();
    await expect(t.query(api.drafts.getMine, { actor: "harbor", draftId })).rejects.toThrow(/contributor role/);
    await expect(t.query(api.references.list, { actor: "harbor", draftId })).rejects.toThrow();
    await expect(t.query(api.reviews.getForReview, { actor: "harbor", draftId })).rejects.toThrow(/reviewer role/);
    await expect(t.query(api.drafts.getMine, { actor: "cobalt", draftId })).rejects.toThrow(/not found/);

    const results = await t.query(api.playbooks.search, { actor: "harbor", query: "" });
    const blob = JSON.stringify(results);
    expect(blob).not.toContain("privateNotes");
    expect(blob).not.toContain("demo-client-42");
    expect(blob).not.toContain("ops@northstar.example");
  });

  it("does not give reviewers the raw private notes", async () => {
    const { t, draftId } = await seeded();
    await prepareAndSubmit(t, draftId);
    const view = await t.query(api.reviews.getForReview, { actor: "review-desk", draftId });
    expect(JSON.stringify(view)).not.toContain("ops@northstar.example");
    expect(view.draft).not.toHaveProperty("privateNotes");
  });

  it("enforces roles on mutations", async () => {
    const { t, draftId } = await seeded();
    await expect(t.mutation(api.validation.runCheck, { actor: "harbor", draftId, step: "before" })).rejects.toThrow(/reviewer role/);
    await expect(
      t.mutation(api.reviews.decide, { actor: "northstar", draftId, decision: "approve", note: "", evidenceLevel: "contributor_reported", checklist: CHECKLIST }),
    ).rejects.toThrow(/reviewer role/);
    const catalog = await t.query(api.playbooks.search, { actor: "harbor", query: "" });
    await expect(t.mutation(api.purchases.startCheckout, { actor: "northstar", playbookId: catalog[0]._id })).rejects.toThrow(/buyer role/);
  });

  it("locks content once submitted", async () => {
    const { t, draftId } = await seeded();
    await prepareAndSubmit(t, draftId);
    await expect(t.mutation(api.drafts.generateSections, { actor: "northstar", draftId })).rejects.toThrow(/locked/);
  });
});
