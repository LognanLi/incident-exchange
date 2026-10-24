import { CONTRIBUTOR_SHARE_PERCENT } from "./domain";

// Money is stored as integer atomic units in strings (USDC: 6 decimals) and computed with BigInt.

export const USDC_DECIMALS = 6;
/** Demo prices must be whole cents of USDC so x402 Money strings are exact. */
export const ATOMIC_PER_CENT = 10_000n;

export function parseAtomic(amount: string): bigint {
  if (!/^\d+$/.test(amount)) throw new Error("Amount must be a non-negative integer string in atomic units");
  return BigInt(amount);
}

/**
 * Split an amount between contributor and platform. The contributor share is rounded down;
 * the platform receives the remainder, so the parts always sum exactly to the amount.
 */
export function splitRevenue(amountAtomic: string): { contributorShareAtomic: string; platformShareAtomic: string } {
  const amount = parseAtomic(amountAtomic);
  const contributor = (amount * BigInt(CONTRIBUTOR_SHARE_PERCENT)) / 100n;
  return { contributorShareAtomic: contributor.toString(), platformShareAtomic: (amount - contributor).toString() };
}

export function sumAtomic(amounts: string[]): string {
  return amounts.reduce((acc, a) => acc + parseAtomic(a), 0n).toString();
}

/** "500000" → "0.50" (at least 2 decimals, trailing zeros beyond that trimmed). */
export function formatAtomic(amountAtomic: string, decimals = USDC_DECIMALS): string {
  const n = parseAtomic(amountAtomic);
  const base = 10n ** BigInt(decimals);
  const whole = n / base;
  let frac = (n % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  if (frac.length < 2) frac = frac.padEnd(2, "0");
  return `${whole}.${frac}`;
}

export function formatPrice(amountAtomic: string, currency = "USDC"): string {
  return `${formatAtomic(amountAtomic)} ${currency}`;
}

/** "0.50" → "500000". Accepts at most 2 decimal places (whole cents). */
export function dollarsToAtomic(input: string): string | null {
  const m = input.trim().match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!m) return null;
  const cents = BigInt(m[1]) * 100n + BigInt((m[2] ?? "").padEnd(2, "0") || "0");
  return (cents * ATOMIC_PER_CENT).toString();
}
