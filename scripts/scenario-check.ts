import "dotenv/config";

import { and, count, eq, gte, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { invoices, orders, organizations } from "@/db/schema";
import { queryCustomerMetrics } from "@/ai/tools/customer-tools";

/**
 * Deterministic data-precondition check for the three demo scenarios (§41). No LLM.
 * Confirms the seeded business data can actually produce compelling findings for each scenario.
 */
const OVERDUE_THRESHOLD_CENTS = 500_000; // $5,000 (Scenario 2)
const QUARTER_DAYS = 90;

async function main() {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, "orqestra-demo"))
    .limit(1);
  if (!org) throw new Error("Demo org not found - run `npm run db:seed` first.");

  // Scenario 1 - Customer Recovery: high-value at-risk cohort.
  const metrics = await queryCustomerMetrics({ organizationId: org.id, userId: "" });

  // Scenario 2 - Invoice Recovery: overdue/failed invoices above $5,000.
  const [inv] = await db
    .select({
      n: count(),
      total: sql<number>`coalesce(sum(${invoices.amountCents}), 0)`,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.organizationId, org.id),
        inArray(invoices.status, ["overdue", "failed"]),
        gte(invoices.amountCents, OVERDUE_THRESHOLD_CENTS),
      ),
    );
  const bigOverdue = Number(inv.n);
  const bigOverdueUsd = Math.round(Number(inv.total) / 100);

  // Scenario 3 - Sales Analysis / Executive Reporting: recent-quarter orders.
  const since = new Date(Date.now() - QUARTER_DAYS * 24 * 3600 * 1000);
  const [ord] = await db
    .select({ n: count(), total: sql<number>`coalesce(sum(${orders.amountCents}), 0)` })
    .from(orders)
    .where(and(eq(orders.organizationId, org.id), gte(orders.placedAt, since)));
  const quarterOrders = Number(ord.n);

  const checks: Record<string, boolean> = {
    "S1 · high-value at-risk = 42": metrics.highValueAtRisk === 42,
    "S1 · recovery opportunity = $184,500": metrics.recoveryOpportunity === 184500,
    "S2 · overdue invoices > $5k ≥ 10": bigOverdue >= 10,
    "S3 · current-quarter orders > 0": quarterOrders > 0,
  };

  console.log("\n── Scenario data preconditions ──");
  console.log(`  Customer Recovery : ${metrics.highValueAtRisk} HVAR · $${metrics.recoveryOpportunity.toLocaleString()} at risk`);
  console.log(`  Invoice Recovery  : ${bigOverdue} overdue invoices ≥ $5k · $${bigOverdueUsd.toLocaleString()} outstanding`);
  console.log(`  Sales/Exec Report : ${quarterOrders.toLocaleString()} orders in the last ${QUARTER_DAYS} days`);
  console.log("");
  for (const [k, v] of Object.entries(checks)) console.log(`  ${v ? "✓" : "✗"} ${k}`);

  const ok = Object.values(checks).every(Boolean);
  console.log(ok ? "\n✅ SCENARIO DATA READY" : "\n⚠️  Some scenarios lack compelling data");
  if (!ok) process.exitCode = 1;
}

main().catch((err) => {
  console.error("✗ scenario-check failed:", err);
  process.exit(1);
});
