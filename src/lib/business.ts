/**
 * Shared business constants + money helpers.
 * The thresholds mirror the seed cohorts (scripts/seed/cohorts.ts) so the Data Analyst
 * tools reproduce the showcase numbers (§9/§59).
 */

/** MRR at/above which a customer counts as "high value" ($2,000/mo). */
export const HIGH_VALUE_MRR_THRESHOLD_CENTS = 200_000;

/** Usage change at/below which a customer counts as "declining" (−30%). */
export const DECLINING_USAGE_THRESHOLD_PCT = -30;

/** Integer cents → dollars (2-decimal precision). */
export function centsToDollars(cents: number): number {
  return Math.round(cents) / 100;
}

/** Dollars → integer cents. */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}
