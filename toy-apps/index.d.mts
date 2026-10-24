// Type declarations for the plain-JS toy app registry (consumed by convex/validation.ts).
type Assertion = { name: string; ok: boolean; detail: string };
type EvalResult = { passed: boolean; summary: string; assertions: Assertion[] };
type ToyCaseDef = { title: string; checkName: string; editableFile: string; vulnerable: unknown; fixed: unknown; evaluate: (mod: unknown) => Promise<EvalResult> };
export declare const CASES: Record<"webhook" | "tenant" | "keycache", ToyCaseDef>;
export declare const CASE_IDS: readonly ("webhook" | "tenant" | "keycache")[];
