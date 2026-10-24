import { CONTRIBUTOR_SHARE_PERCENT } from "./domain";

/**
 * Split an integer amount (minor units) between contributor and platform.
 * The contributor share is rounded down; the platform receives the remainder,
 * so the two parts always sum exactly to the amount.
 */
export function splitRevenue(amountMinorUnits: number): {
  contributorShareMinorUnits: number;
  platformShareMinorUnits: number;
} {
  if (!Number.isInteger(amountMinorUnits) || amountMinorUnits < 0) {
    throw new Error("Amount must be a non-negative integer in minor units");
  }
  const contributorShareMinorUnits = Math.floor((amountMinorUnits * CONTRIBUTOR_SHARE_PERCENT) / 100);
  return {
    contributorShareMinorUnits,
    platformShareMinorUnits: amountMinorUnits - contributorShareMinorUnits,
  };
}
