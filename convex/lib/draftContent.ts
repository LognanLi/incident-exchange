import type { Doc } from "../_generated/dataModel";
import { SECTION_KEYS } from "./domain";
import { contentHash } from "./privacy";

/** Exactly the fields that would become buyer-visible on publication. */
export function buyerFacingFields(draft: Doc<"incidentDrafts">): Record<string, string> {
  const fields: Record<string, string> = {
    publicTitle: draft.publicTitle,
    sanitizedSummary: draft.sanitizedSummary,
  };
  if (draft.sections) {
    for (const key of SECTION_KEYS) fields[key] = draft.sections[key].body;
  }
  return fields;
}

export function draftContentHash(draft: Doc<"incidentDrafts">): string {
  return contentHash([
    ...Object.values(buyerFacingFields(draft)),
    draft.systemCategories.join(","),
    String(draft.priceMinorUnits),
    draft.currency,
    draft.sharingLevel,
  ]);
}

export function identifyingTermsFor(draft: Doc<"incidentDrafts">, org: Doc<"organizations">): string[] {
  const terms = [org.displayName, ...draft.identifyingTerms];
  const firstWord = org.displayName.split(/\s+/)[0];
  if (firstWord && firstWord.length >= 5) terms.push(firstWord);
  return [...new Set(terms.map((t) => t.trim()).filter(Boolean))];
}

export type ReadinessIssue = string;

/** Why the draft cannot yet be approved and submitted (empty = ready). */
export function submissionBlockers(draft: Doc<"incidentDrafts">): ReadinessIssue[] {
  const issues: string[] = [];
  if (!draft.publicTitle.trim()) issues.push("Add a public title.");
  if (!draft.sanitizedSummary.trim()) issues.push("Add a public summary.");
  if (!draft.sections) {
    issues.push("Draft the six-part playbook.");
  } else {
    for (const key of SECTION_KEYS) {
      if (!draft.sections[key].body.trim()) issues.push(`Section “${key}” is empty.`);
      else if (!draft.sections[key].accepted) issues.push(`Accept the “${key}” section.`);
    }
  }
  if (draft.privacyScannedHash !== draftContentHash(draft)) {
    issues.push("Run the privacy scan on the current version.");
  } else if (draft.privacyFindings.some((f) => f.severity === "high")) {
    issues.push("Resolve all high-severity privacy findings.");
  }
  return issues;
}
