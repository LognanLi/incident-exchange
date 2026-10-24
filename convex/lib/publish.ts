import type { Doc } from "../_generated/dataModel";

export function publicAliasFor(sharingLevel: Doc<"incidentDrafts">["sharingLevel"], org: Doc<"organizations">): string {
  return sharingLevel === "anonymous" ? "Anonymous contributor" : org.publicAlias;
}

/** Only buyer-facing preview fields are indexed for search. */
export function buildSearchText(pb: {
  publicTitle: string;
  publicSummary: string;
  publicSteps: { recognize: string };
  systemCategories: string[];
}): string {
  return [pb.publicTitle, pb.publicSummary, pb.publicSteps.recognize, pb.systemCategories.join(" ")].join("\n");
}
