export type FactKey =
  | "runtime.node"
  | "delivery.stable_message_ids"
  | "store.atomic_claim"
  | "duplicates.distinct_ids"
  | "records.tenant_scoped"
  | "request.authenticated_tenant"
  | "access.fetch_by_client_id"
  | "access.cross_tenant_sharing";
export const FACTS: Record<FactKey, { label: string }>;
export const FACT_KEYS: FactKey[];
export const APPLICABILITY_LIMITS: { conditions: number; facts: number; note: number; source: number };

export type Condition = { fact: string; expected: boolean; note?: string };
export type Fact = { fact: string; value: boolean; source: string };
export type KnownItem = { fact: string; label: string; expected: boolean; observed: boolean; source: string; note?: string };
export type OpenItem = { fact: string | null; label: string; expected: boolean | null; note?: string };
export type Recommendation = "recommend" | "verify_first" | "decline";
export type Evaluation = { matched: KnownItem[]; conflicts: KnownItem[]; needsVerification: OpenItem[]; recommendation: Recommendation; reason: string };

export function validateConditions(conditions: unknown): Condition[];
export function validateFacts(facts: unknown): Fact[];
export function evaluateApplicability(conditions: Condition[], facts: Fact[], opts?: { freeTextChecks?: string[] }): Evaluation;
