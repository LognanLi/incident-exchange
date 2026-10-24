import type { Doc } from "../_generated/dataModel";
import { SECTION_KEYS } from "./domain";
import { contentHash } from "./privacy";

/** Exactly the fields that would become buyer-visible on publication. */
export function buyerFacingFields(draft: Doc<"incidentDrafts">): Record<string, string> {
  const fields: Record<string, string> = {
    publicTitle: draft.publicTitle,
    sanitizedSummary: draft.sanitizedSummary,
    failedAttempts: draft.failedAttempts,
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
    draft.priceAtomic,
    draft.environment.join(","),
    draft.currency,
    draft.sharingLevel,
  ]);
}

/** Private names to flag: organization names (with the first word of the org name) and contributor-listed names. */
export function identifyingTermsFor(
  draft: Doc<"incidentDrafts">,
  org: Doc<"organizations">,
): { orgTerms: string[]; otherTerms: string[] } {
  const orgTerms = [org.displayName];
  const firstWord = org.displayName.split(/\s+/)[0];
  if (firstWord && firstWord.length >= 5) orgTerms.push(firstWord);
  return { orgTerms, otherTerms: [...new Set(draft.identifyingTerms.map((t) => t.trim()).filter(Boolean))] };
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
