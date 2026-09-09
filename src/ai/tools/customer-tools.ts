import { and, asc, count, desc, eq, gte, ilike, lte, or, sql, type SQL } from "drizzle-orm";
import { tool } from "ai";
import { z } from "zod";

import { db } from "@/db";
import { customers, customerStatus, riskLevel } from "@/db/schema";
import {
  DECLINING_USAGE_THRESHOLD_PCT,
  HIGH_VALUE_MRR_THRESHOLD_CENTS,
  centsToDollars,
  dollarsToCents,
} from "@/lib/business";

import type { ToolContext } from "./context";

// --- shapes -------------------------------------------------------------------
export type CustomerSummary = {
  id: string;
  externalRef: string;
  name: string;
  company: string | null;
  email: string;
  plan: string | null;
  mrr: number;
  lifetimeValue: number;
  status: string;
  riskLevel: string;
  healthScore: number;
  usageChangePct: number;
  signedUpAt: string | null;
  lastActiveAt: string | null;
};

type Row = typeof customers.$inferSelect;

function toSummary(r: Row): CustomerSummary {
  return {
    id: r.id,
    externalRef: r.externalRef,
    name: r.name,
    company: r.company,
    email: r.email,
    plan: r.plan,
    mrr: centsToDollars(r.mrrCents),
    lifetimeValue: centsToDollars(r.lifetimeValueCents),
    status: r.status,
    riskLevel: r.riskLevel,
    healthScore: r.healthScore,
    usageChangePct: r.usageChangePct,
    signedUpAt: r.signedUpAt?.toISOString() ?? null,
    lastActiveAt: r.lastActiveAt?.toISOString() ?? null,
  };
}

// --- getCustomers -------------------------------------------------------------
export const getCustomersInput = z.object({
  status: z.enum(customerStatus.enumValues).optional(),
  riskLevel: z.enum(riskLevel.enumValues).optional(),
  plan: z.string().optional(),
  minMrr: z
    .number()
    .nonnegative()
    .optional()
    .describe("Minimum monthly recurring revenue, in dollars"),
  maxUsageChangePct: z
    .number()
    .optional()
    .describe("Only customers whose usage change % is at or below this (e.g. -30 for a 30%+ drop)"),
  search: z.string().optional().describe("Match against name, company, or email"),
  sortBy: z.enum(["mrr", "usageChange", "healthScore", "recent"]).optional(),
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
});
export type GetCustomersInput = z.input<typeof getCustomersInput>;

function customerFilters(ctx: ToolContext, input: GetCustomersInput): SQL[] {
  const conds: SQL[] = [eq(customers.organizationId, ctx.organizationId)];
  if (input.status) conds.push(eq(customers.status, input.status));
  if (input.riskLevel) conds.push(eq(customers.riskLevel, input.riskLevel));
  if (input.plan) conds.push(eq(customers.plan, input.plan));
  if (input.minMrr !== undefined) conds.push(gte(customers.mrrCents, dollarsToCents(input.minMrr)));
  if (input.maxUsageChangePct !== undefined)
    conds.push(lte(customers.usageChangePct, input.maxUsageChangePct));
  if (input.search) {
    const term = `%${input.search}%`;
    const match = or(
      ilike(customers.name, term),
      ilike(customers.company, term),
      ilike(customers.email, term),
    );
    if (match) conds.push(match);
  }
  return conds;
}

export async function queryCustomers(ctx: ToolContext, input: GetCustomersInput) {
  const conds = customerFilters(ctx, input);
  const where = and(...conds);

  const orderBy =
    input.sortBy === "usageChange"
      ? asc(customers.usageChangePct)
      : input.sortBy === "healthScore"
        ? asc(customers.healthScore)
        : input.sortBy === "recent"
          ? desc(customers.lastActiveAt)
          : desc(customers.mrrCents);

  const limit = input.limit ?? 50;
  const offset = input.offset ?? 0;

  const [rows, [{ total }]] = await Promise.all([
    db.select().from(customers).where(where).orderBy(orderBy).limit(limit).offset(offset),
    db.select({ total: count() }).from(customers).where(where),
  ]);

  return { customers: rows.map(toSummary), total, returned: rows.length };
}

// --- getCustomer --------------------------------------------------------------
export const getCustomerInput = z
  .object({
    customerId: z.string().optional(),
    externalRef: z.string().optional().describe("e.g. CUS-1042"),
  })
  .refine((v) => v.customerId || v.externalRef, {
    message: "Provide customerId or externalRef",
  });
export type GetCustomerInput = z.input<typeof getCustomerInput>;

export async function queryCustomer(
  ctx: ToolContext,
  input: GetCustomerInput,
): Promise<CustomerSummary | null> {
  const ident = input.customerId
    ? eq(customers.id, input.customerId)
    : eq(customers.externalRef, input.externalRef!);
  const [row] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.organizationId, ctx.organizationId), ident))
    .limit(1);
  return row ? toSummary(row) : null;
}

// --- getCustomerMetrics -------------------------------------------------------
export const getCustomerMetricsInput = z.object({});
export type GetCustomerMetricsInput = z.input<typeof getCustomerMetricsInput>;

const hvarPredicate = sql`${customers.status} = 'at_risk' and ${customers.mrrCents} >= ${HIGH_VALUE_MRR_THRESHOLD_CENTS} and ${customers.usageChangePct} <= ${DECLINING_USAGE_THRESHOLD_PCT}`;

export async function queryCustomerMetrics(ctx: ToolContext) {
  const [row] = await db
    .select({
      total: count(),
      atRisk: sql<number>`count(*) filter (where ${customers.status} = 'at_risk')`,
      hvar: sql<number>`count(*) filter (where ${hvarPredicate})`,
      hvarMrrCents: sql<number>`coalesce(sum(${customers.mrrCents}) filter (where ${hvarPredicate}), 0)`,
      totalMrrCents: sql<number>`coalesce(sum(${customers.mrrCents}), 0)`,
      atRiskMrrCents: sql<number>`coalesce(sum(${customers.mrrCents}) filter (where ${customers.status} = 'at_risk'), 0)`,
      churned: sql<number>`count(*) filter (where ${customers.status} = 'churned')`,
      recovered: sql<number>`count(*) filter (where ${customers.status} = 'recovered')`,
      avgHealth: sql<number>`coalesce(avg(${customers.healthScore}), 0)`,
    })
    .from(customers)
    .where(eq(customers.organizationId, ctx.organizationId));

  return {
    customersAnalyzed: Number(row.total),
    highRiskCustomers: Number(row.atRisk),
    highValueAtRisk: Number(row.hvar),
    recoveryOpportunity: centsToDollars(Number(row.hvarMrrCents)),
    totalMrr: centsToDollars(Number(row.totalMrrCents)),
    atRiskMrr: centsToDollars(Number(row.atRiskMrrCents)),
    churnedCount: Number(row.churned),
    recoveredCount: Number(row.recovered),
    avgHealthScore: Math.round(Number(row.avgHealth)),
  };
}

// --- tool wrappers ------------------------------------------------------------
export function createCustomerTools(ctx: ToolContext) {
  return {
    getCustomers: tool({
      description:
        "List and filter customers by status, risk level, plan, minimum MRR, usage decline, or search text. Returns a bounded set of rows plus the total number of matches.",
      inputSchema: getCustomersInput,
      execute: (input) => queryCustomers(ctx, input),
    }),
    getCustomer: tool({
      description: "Fetch a single customer's details by id or external reference (e.g. CUS-1042).",
      inputSchema: getCustomerInput,
      execute: (input) => queryCustomer(ctx, input),
    }),
    getCustomerMetrics: tool({
      description:
        "Portfolio-level customer metrics: totals, at-risk and high-value-at-risk counts, MRR sums, recovery opportunity, churn/recovery counts, and average health.",
      inputSchema: getCustomerMetricsInput,
      execute: () => queryCustomerMetrics(ctx),
    }),
  };
}
