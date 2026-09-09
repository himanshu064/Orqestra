/**
 * Cohort definitions for the synthetic dataset (requirements §25).
 * Counts are engineered to hit the showcase numbers (§9, §59):
 *   2,481 customers · 137 at-risk · 42 high-value-at-risk · $184,500 recovery opportunity.
 */

export type CohortKey =
  | "healthy"
  | "high_value_declining"
  | "high_value_failed"
  | "low_activity_complaints"
  | "recovered"
  | "churned";

export type CustomerStatus = "active" | "at_risk" | "churned" | "recovered";
export type RiskLevel = "low" | "medium" | "high";
export type SubStatus = "trialing" | "active" | "past_due" | "paused" | "canceled";

export interface CohortSpec {
  key: CohortKey;
  label: string;
  count: number;
  customerStatus: CustomerStatus;
  riskLevel: RiskLevel;
  /** [min, max] inclusive health score. */
  health: [number, number];
  /** [min, max] usage change %, e.g. [-60, -30]. */
  usageChangePct: [number, number];
  /** [min, max] monthly recurring revenue in cents. */
  mrrCents: [number, number];
  subStatus: SubStatus;
  /** [min, max] number of support tickets to create. */
  ticketCount: [number, number];
  /** Whether to give this customer failed/overdue invoices + payment_failed events. */
  hasFailedPayments: boolean;
  /** The flagship "high-value at-risk" cohort (the 42). */
  isHighValueAtRisk?: boolean;
}

export const TOTAL_CUSTOMERS = 2481;

/** Total at-risk MRR of the high-value-declining cohort = the "recovery opportunity" (§59). */
export const RECOVERY_OPPORTUNITY_CENTS = 18_450_000; // $184,500

/** MRR at/above which a customer counts as "high value" (used by analyst + verification). */
export const HIGH_VALUE_MRR_THRESHOLD_CENTS = 200_000; // $2,000 / mo

/** Usage drop at/below which a customer counts as "declining" (used by analyst + verification). */
export const DECLINING_USAGE_THRESHOLD_PCT = -30;

export const COHORTS: CohortSpec[] = [
  {
    key: "healthy",
    label: "Healthy / active",
    count: 2202,
    customerStatus: "active",
    riskLevel: "low",
    health: [70, 100],
    usageChangePct: [-5, 35],
    mrrCents: [9_900, 149_900], // $99–$1,499
    subStatus: "active",
    ticketCount: [0, 1],
    hasFailedPayments: false,
  },
  {
    key: "high_value_declining",
    label: "High-value + declining usage",
    count: 42,
    customerStatus: "at_risk",
    riskLevel: "high",
    health: [20, 45],
    usageChangePct: [-60, -30],
    // Base range; seed.ts adjusts the cohort so total MRR == RECOVERY_OPPORTUNITY_CENTS.
    mrrCents: [300_000, 600_000], // $3,000–$6,000
    subStatus: "past_due",
    ticketCount: [1, 3],
    hasFailedPayments: false,
    isHighValueAtRisk: true,
  },
  {
    key: "high_value_failed",
    label: "High-value + failed payments",
    count: 30,
    customerStatus: "at_risk",
    riskLevel: "high",
    health: [35, 55],
    usageChangePct: [-25, 5],
    // $3,000–$9,000 so overdue invoices (= MRR) span the $5k threshold for Scenario 2
    // (Invoice Recovery: "overdue above $5,000"). NOT counted as high-value-at-risk (that
    // requires usage ≤ −30%), so the flagship 42 / $184,500 numbers are unaffected.
    mrrCents: [300_000, 900_000],
    subStatus: "past_due",
    ticketCount: [1, 3],
    hasFailedPayments: true,
  },
  {
    key: "low_activity_complaints",
    label: "Low activity + complaints",
    count: 65,
    customerStatus: "at_risk",
    riskLevel: "medium",
    health: [25, 50],
    usageChangePct: [-40, -10],
    mrrCents: [4_900, 39_900], // $49–$399
    subStatus: "active",
    ticketCount: [2, 4],
    hasFailedPayments: false,
  },
  {
    key: "recovered",
    label: "Recently recovered",
    count: 42,
    customerStatus: "recovered",
    riskLevel: "low",
    health: [55, 75],
    usageChangePct: [10, 40],
    mrrCents: [50_000, 300_000], // $500–$3,000
    subStatus: "active",
    ticketCount: [0, 2],
    hasFailedPayments: false,
  },
  {
    key: "churned",
    label: "Churned",
    count: 100,
    customerStatus: "churned",
    riskLevel: "high",
    health: [0, 20],
    usageChangePct: [-95, -60],
    mrrCents: [0, 0],
    subStatus: "canceled",
    ticketCount: [0, 3],
    hasFailedPayments: false,
  },
];

// Compile-time-ish sanity: total must equal TOTAL_CUSTOMERS.
export const COHORT_TOTAL = COHORTS.reduce((s, c) => s + c.count, 0);
