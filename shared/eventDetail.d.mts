export type DetailEntry = { k: string; v: string };
export type EventDetail = { tool?: string; input?: DetailEntry[]; result?: string; resolutionId?: string; revision?: number; evidence?: DetailEntry[] };
export const DETAIL_LIMITS: { entries: number; key: number; value: number; result: number };
export function sanitizeEventDetail(d: unknown): EventDetail | undefined;
export function sanitizeEventText(value: unknown, max?: number): string;
