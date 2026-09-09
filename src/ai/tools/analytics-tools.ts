import { and, count, eq, inArray, sql, type SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { tool } from "ai";
import { z } from "zod";

import { db } from "@/db";
import { customers, invoices, orders } from "@/db/schema";
import { centsToDollars } from "@/lib/business";

import type { ToolContext } from "./context";

export const runAnalyticsInput = z.object({
  metric: z.enum(["revenue", "mrr", "customers", "overdue_amount", "churn"]),
  groupBy: z.enum(["status", "risk_level", "plan", "subscription_status"]).optional(),
});
export type RunAnalyticsInput = z.input<typeof runAnalyticsInput>;

export type AnalyticsRow = { key: string; count: number; value: number };
export type AnalyticsResult = { metric: string; groupBy?: string; rows: AnalyticsRow[] };

/** Resolve the allowed group column for a customer-based metric (fixed set  no SQL injection surface). */
function customerGroupColumn(groupBy: RunAnalyticsInput["groupBy"]): PgColumn | null {
  switch (groupBy) {
    case "status":
      return customers.status;
    case "risk_level":
      return customers.riskLevel;
    case "plan":
      return customers.plan;
    default:
      return null; // subscription_status / undefined → ungrouped for customer metrics
  }
}

/** Count rows in a table, optionally grouped by a fixed column. `money` sums a cents column instead. */
async function aggregate(opts: {
  metric: string;
  groupBy?: string;
  where: SQL;
  from: PgTable;
  groupCol: PgColumn | null;
  moneyCol?: PgColumn;
}): Promise<AnalyticsResult> {
  const valueExpr = opts.moneyCol
    ? sql<number>`coalesce(sum(${opts.moneyCol}), 0)`
    : sql<number>`count(*)`;
  const toValue = (raw: number) => (opts.moneyCol ? centsToDollars(Number(raw)) : Number(raw));

  if (!opts.groupCol) {
    const [row] = await db
      .select({ count: count(), value: valueExpr })
      .from(opts.from)
      .where(opts.where);
    return {
      metric: opts.metric,
      rows: [{ key: "all", count: Number(row.count), value: toValue(row.value) }],
    };
  }

  const rows = await db
    .select({ key: opts.groupCol, count: count(), value: valueExpr })
    .from(opts.from)
    .where(opts.where)
    .groupBy(opts.groupCol);

  return {
    metric: opts.metric,
    groupBy: opts.groupBy,
    rows: rows
      .map((r) => ({ key: String(r.key), count: Number(r.count), value: toValue(r.value) }))
      .sort((a, b) => b.value - a.value),
  };
}

export async function runAnalytics(
  ctx: ToolContext,
  input: RunAnalyticsInput,
): Promise<AnalyticsResult> {
  const org = ctx.organizationId;

  switch (input.metric) {
    case "customers":
      return aggregate({
        metric: "customers",
        groupBy: input.groupBy,
        where: eq(customers.organizationId, org),
        from: customers,
        groupCol: customerGroupColumn(input.groupBy),
      });
    case "churn":
      return aggregate({
        metric: "churn",
        groupBy: input.groupBy,
        where: and(eq(customers.organizationId, org), eq(customers.status, "churned"))!,
        from: customers,
        groupCol: customerGroupColumn(input.groupBy),
      });
    case "mrr":
      return aggregate({
        metric: "mrr",
        groupBy: input.groupBy,
        where: eq(customers.organizationId, org),
        from: customers,
        groupCol: customerGroupColumn(input.groupBy),
        moneyCol: customers.mrrCents,
      });
    case "revenue":
      return aggregate({
        metric: "revenue",
        groupBy: input.groupBy === "status" ? "status" : undefined,
        where: eq(orders.organizationId, org),
        from: orders,
        groupCol: input.groupBy === "status" ? orders.status : null,
        moneyCol: orders.amountCents,
      });
    case "overdue_amount":
      return aggregate({
        metric: "overdue_amount",
        groupBy: input.groupBy === "status" ? "status" : undefined,
        where: and(
          eq(invoices.organizationId, org),
          inArray(invoices.status, ["overdue", "failed"]),
        )!,
        from: invoices,
        groupCol: input.groupBy === "status" ? invoices.status : null,
        moneyCol: invoices.amountCents,
      });
  }
}

export function createAnalyticsTools(ctx: ToolContext) {
  return {
    runAnalytics: tool({
      description:
        "Run a predefined analytics query. metric ∈ revenue|mrr|customers|overdue_amount|churn, optionally grouped by status|risk_level|plan. Returns aggregated rows (count + dollar value).",
      inputSchema: runAnalyticsInput,
      execute: (input) => runAnalytics(ctx, input),
    }),
  };
}
