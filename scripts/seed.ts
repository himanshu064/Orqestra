import "dotenv/config";

import { randomUUID } from "node:crypto";

import { neon } from "@neondatabase/serverless";
import { faker } from "@faker-js/faker";
import { and, count, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "../src/db/schema";
import {
  COHORTS,
  COHORT_TOTAL,
  DECLINING_USAGE_THRESHOLD_PCT,
  HIGH_VALUE_MRR_THRESHOLD_CENTS,
  RECOVERY_OPPORTUNITY_CENTS,
  TOTAL_CUSTOMERS,
  type CohortSpec,
} from "./seed/cohorts";
import { chance, daysAgo, intBetween, mulberry32, pick, type Rng } from "./seed/rng";

// --- deterministic sources ----------------------------------------------------
const SEED = 20260908;
faker.seed(SEED);
const rng: Rng = mulberry32(SEED);
const NOW = new Date();

// --- inferred insert types ----------------------------------------------------
type NewCustomer = typeof schema.customers.$inferInsert;
type NewSubscription = typeof schema.subscriptions.$inferInsert;
type NewOrder = typeof schema.orders.$inferInsert;
type NewInvoice = typeof schema.invoices.$inferInsert;
type NewTicket = typeof schema.supportTickets.$inferInsert;
type NewEvent = typeof schema.customerEvents.$inferInsert;

// --- helpers ------------------------------------------------------------------
function planForMrr(mrrCents: number): string {
  if (mrrCents < 10_000) return "Starter";
  if (mrrCents < 50_000) return "Growth";
  if (mrrCents < 200_000) return "Scale";
  return "Enterprise";
}

/** Distribute a target total across `n` values within a base range, exact sum. */
function mrrValuesExactSum(n: number, min: number, max: number, target: number): number[] {
  const raw = Array.from({ length: n }, () => intBetween(rng, min, max));
  const rawSum = raw.reduce((s, v) => s + v, 0);
  const scaled = raw.map((v) => Math.round((v / rawSum) * target));
  const drift = target - scaled.reduce((s, v) => s + v, 0);
  scaled[scaled.length - 1]! += drift; // absorb rounding on the last element
  return scaled;
}

async function insertChunked<T>(
  label: string,
  table: Parameters<typeof db.insert>[0],
  rows: T[],
  size = 2000,
): Promise<void> {
  for (let i = 0; i < rows.length; i += size) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.insert(table).values(rows.slice(i, i + size) as any);
  }
  console.log(`  · ${label}: ${rows.length}`);
}

// --- client -------------------------------------------------------------------
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set.");
const client = neon(url);
const db = drizzle(client, { schema, casing: "snake_case" });

const AGENT_META: {
  key: (typeof schema.agents.$inferInsert)["key"];
  displayName: string;
  description: string;
}[] = [
  {
    key: "manager",
    displayName: "Manager Agent",
    description: "Orchestrator  plans, delegates to specialists, reviews, and finalizes.",
  },
  {
    key: "data_analyst",
    displayName: "Data Analyst Agent",
    description: "Analyzes structured business data and returns structured findings.",
  },
  {
    key: "research",
    displayName: "Research Agent",
    description: "Gathers context from the knowledge base and customer history.",
  },
  {
    key: "communication",
    displayName: "Communication Agent",
    description: "Drafts emails and CRM tasks; sensitive actions require human approval.",
  },
];

async function main() {
  console.log("Seeding Orqestra demo data…");

  // 1) Organization (idempotent by slug).
  const [org] = await db
    .insert(schema.organizations)
    .values({ name: "Orqestra Demo", slug: "orqestra-demo" })
    .onConflictDoUpdate({
      target: schema.organizations.slug,
      set: { name: "Orqestra Demo", updatedAt: NOW },
    })
    .returning();
  if (!org) throw new Error("failed to upsert organization");
  const organizationId = org.id;

  // 2) Demo user (idempotent by email). Password is set in Phase 3.
  await db
    .insert(schema.users)
    .values({
      organizationId,
      email: "manager@orqestra.demo",
      name: "Alex Morgan",
      role: "manager",
    })
    .onConflictDoUpdate({
      target: schema.users.email,
      set: { organizationId, name: "Alex Morgan", role: "manager", updatedAt: NOW },
    });

  // 3) Agent config rows (replace).
  await db.delete(schema.agents).where(eq(schema.agents.organizationId, organizationId));
  await db.insert(schema.agents).values(
    AGENT_META.map((a) => ({
      organizationId,
      key: a.key,
      displayName: a.displayName,
      description: a.description,
      enabled: true,
    })),
  );

  // 4) Clear existing business data for this org (cascades to related tables).
  await db.delete(schema.customers).where(eq(schema.customers.organizationId, organizationId));

  // 5) Build all rows in memory (client-generated UUIDs so we avoid round-trips).
  const customers: NewCustomer[] = [];
  const subscriptions: NewSubscription[] = [];
  const orders: NewOrder[] = [];
  const invoices: NewInvoice[] = [];
  const tickets: NewTicket[] = [];
  const events: NewEvent[] = [];

  let custSeq = 1000;
  let invSeq = 100000;

  const ticketSubjects = [
    "Billing discrepancy on latest invoice",
    "Unable to access advanced reporting",
    "Integration webhook failing intermittently",
    "Requesting help with onboarding",
    "Performance degradation in dashboard",
    "Feature request: bulk export",
    "Payment method was declined",
    "Question about plan limits",
  ];
  const ticketCategories = ["billing", "technical", "onboarding", "account", "feature"];

  for (const cohort of COHORTS) {
    const highValueMrr = cohort.isHighValueAtRisk
      ? mrrValuesExactSum(
          cohort.count,
          cohort.mrrCents[0],
          cohort.mrrCents[1],
          RECOVERY_OPPORTUNITY_CENTS,
        )
      : null;

    for (let i = 0; i < cohort.count; i++) {
      buildCustomer(cohort, i, highValueMrr);
    }
  }

  function buildCustomer(cohort: CohortSpec, i: number, highValueMrr: number[] | null) {
    custSeq += 1;
    const customerId = randomUUID();
    const mrrCents = highValueMrr
      ? highValueMrr[i]!
      : intBetween(rng, cohort.mrrCents[0], cohort.mrrCents[1]);
    const health = intBetween(rng, cohort.health[0], cohort.health[1]);
    const usageChangePct = intBetween(rng, cohort.usageChangePct[0], cohort.usageChangePct[1]);

    const signedUpAt = daysAgo(rng, NOW, intBetween(rng, 120, 900));
    const lastActiveAt =
      cohort.customerStatus === "churned"
        ? daysAgo(rng, NOW, intBetween(rng, 60, 300))
        : cohort.customerStatus === "at_risk"
          ? daysAgo(rng, NOW, intBetween(rng, 7, 45))
          : daysAgo(rng, NOW, intBetween(rng, 0, 10));

    const lifetimeValueCents =
      cohort.customerStatus === "churned"
        ? intBetween(rng, 100_000, 2_000_000)
        : mrrCents * intBetween(rng, 6, 36) + intBetween(rng, 0, 500_000);

    customers.push({
      id: customerId,
      organizationId,
      externalRef: `CUS-${custSeq}`,
      name: faker.person.fullName(),
      company: faker.company.name(),
      email: faker.internet.email().toLowerCase(),
      plan: planForMrr(mrrCents),
      mrrCents,
      lifetimeValueCents,
      status: cohort.customerStatus,
      riskLevel: cohort.riskLevel,
      healthScore: health,
      usageChangePct,
      signedUpAt,
      lastActiveAt,
    });

    // Subscription (1 per customer).
    subscriptions.push({
      id: randomUUID(),
      organizationId,
      customerId,
      plan: planForMrr(mrrCents),
      status: cohort.subStatus,
      mrrCents,
      startedAt: signedUpAt,
      renewsAt: cohort.subStatus === "canceled" ? null : daysAgo(rng, NOW, -intBetween(rng, 1, 30)),
      canceledAt: cohort.subStatus === "canceled" ? lastActiveAt : null,
    });

    // Orders (weighted by cohort).
    const orderCount =
      cohort.key === "healthy"
        ? intBetween(rng, 3, 8)
        : cohort.key === "churned"
          ? intBetween(rng, 0, 3)
          : cohort.key === "low_activity_complaints"
            ? intBetween(rng, 1, 3)
            : intBetween(rng, 2, 6);
    for (let o = 0; o < orderCount; o++) {
      orders.push({
        id: randomUUID(),
        organizationId,
        customerId,
        amountCents: intBetween(rng, 5_000, 500_000),
        status: "completed",
        placedAt: daysAgo(rng, NOW, intBetween(rng, 1, 540)),
      });
    }

    // Invoices (recent monthly). Failed/overdue for the failed-payment cohort.
    const invoiceCount =
      cohort.customerStatus === "churned" ? intBetween(rng, 1, 3) : intBetween(rng, 3, 7);
    for (let m = 0; m < invoiceCount; m++) {
      invSeq += 1;
      const dueAt = daysAgo(rng, NOW, m * 30 + intBetween(rng, 0, 5));
      let status: NewInvoice["status"] = "paid";
      let paidAt: Date | null = daysAgo(rng, NOW, m * 30 - intBetween(rng, 0, 3));
      if (cohort.hasFailedPayments && m < 2) {
        status = pick(rng, ["failed", "overdue"] as const);
        paidAt = null;
      } else if (m === 0 && cohort.customerStatus !== "churned") {
        status = "open"; // current month not yet paid
        paidAt = null;
      }
      invoices.push({
        id: randomUUID(),
        organizationId,
        customerId,
        number: `INV-${invSeq}`,
        amountCents: mrrCents > 0 ? mrrCents : intBetween(rng, 4_900, 49_900),
        status,
        dueAt,
        paidAt,
      });
    }

    // Support tickets.
    const ticketCount = intBetween(rng, cohort.ticketCount[0], cohort.ticketCount[1]);
    for (let t = 0; t < ticketCount; t++) {
      const unresolved = cohort.customerStatus === "at_risk" && chance(rng, 0.6);
      tickets.push({
        id: randomUUID(),
        organizationId,
        customerId,
        subject: pick(rng, ticketSubjects),
        category: pick(rng, ticketCategories),
        priority: unresolved ? pick(rng, ["high", "urgent"]) : pick(rng, ["low", "normal"]),
        status: unresolved
          ? pick(rng, ["open", "pending"] as const)
          : pick(rng, ["resolved", "closed"] as const),
        resolvedAt: unresolved ? null : daysAgo(rng, NOW, intBetween(rng, 1, 120)),
      });
    }

    // Customer events: 12 weekly usage samples encoding the trend, + payment_failed.
    const baseline = intBetween(rng, 20, 120);
    for (let w = 11; w >= 0; w--) {
      // Interpolate usage from baseline (12 weeks ago) to baseline*(1+usageChangePct/100) now.
      const progress = (11 - w) / 11;
      const factor = 1 + (usageChangePct / 100) * progress;
      const value = Math.max(0, Math.round(baseline * factor) + intBetween(rng, -3, 3));
      events.push({
        id: randomUUID(),
        organizationId,
        customerId,
        type: "usage",
        value,
        occurredAt: daysAgo(rng, NOW, w * 7),
      });
    }
    if (cohort.hasFailedPayments) {
      const fails = intBetween(rng, 1, 3);
      for (let f = 0; f < fails; f++) {
        events.push({
          id: randomUUID(),
          organizationId,
          customerId,
          type: "payment_failed",
          value: 1,
          occurredAt: daysAgo(rng, NOW, intBetween(rng, 1, 60)),
        });
      }
    }
  }

  // 6) Bulk insert (chunked).
  console.log("Inserting rows…");
  await insertChunked("customers", schema.customers, customers);
  await insertChunked("subscriptions", schema.subscriptions, subscriptions);
  await insertChunked("orders", schema.orders, orders);
  await insertChunked("invoices", schema.invoices, invoices);
  await insertChunked("support_tickets", schema.supportTickets, tickets);
  await insertChunked("customer_events", schema.customerEvents, events);

  // 7) Verify against the showcase numbers.
  await verify(organizationId);

  console.log("\n✅ Seed complete.");
}

async function verify(organizationId: string) {
  console.log("\nVerification:");
  const totalCustomers = await countWhere(eq(schema.customers.organizationId, organizationId));
  const atRisk = await countWhere(
    and(
      eq(schema.customers.organizationId, organizationId),
      eq(schema.customers.status, "at_risk"),
    ),
  );
  const recovered = await countWhere(
    and(
      eq(schema.customers.organizationId, organizationId),
      eq(schema.customers.status, "recovered"),
    ),
  );
  const churned = await countWhere(
    and(
      eq(schema.customers.organizationId, organizationId),
      eq(schema.customers.status, "churned"),
    ),
  );
  const highValueAtRisk = await countWhere(
    and(
      eq(schema.customers.organizationId, organizationId),
      eq(schema.customers.status, "at_risk"),
      gte(schema.customers.mrrCents, HIGH_VALUE_MRR_THRESHOLD_CENTS),
      lte(schema.customers.usageChangePct, DECLINING_USAGE_THRESHOLD_PCT),
    ),
  );

  const [{ opp }] = await db
    .select({ opp: sql<number>`coalesce(sum(${schema.customers.mrrCents}), 0)` })
    .from(schema.customers)
    .where(
      and(
        eq(schema.customers.organizationId, organizationId),
        eq(schema.customers.status, "at_risk"),
        gte(schema.customers.mrrCents, HIGH_VALUE_MRR_THRESHOLD_CENTS),
        lte(schema.customers.usageChangePct, DECLINING_USAGE_THRESHOLD_PCT),
      ),
    );

  const [{ n: orderCount }] = await db
    .select({ n: count() })
    .from(schema.orders)
    .where(eq(schema.orders.organizationId, organizationId));

  const check = (label: string, actual: number, expected: number) =>
    console.log(`  ${actual === expected ? "✓" : "✗"} ${label}: ${actual} (expected ${expected})`);

  check("customers", totalCustomers, TOTAL_CUSTOMERS);
  check("cohort total (config)", COHORT_TOTAL, TOTAL_CUSTOMERS);
  check("at-risk", atRisk, 137);
  check("recovered", recovered, 42);
  check("churned", churned, 100);
  check("high-value at-risk", highValueAtRisk, 42);
  console.log(
    `  ${Number(opp) === RECOVERY_OPPORTUNITY_CENTS ? "✓" : "✗"} recovery opportunity: $${(Number(opp) / 100).toLocaleString()} (expected $184,500)`,
  );
  console.log(`  ${orderCount >= 10000 ? "✓" : "✗"} orders: ${orderCount} (expected ≥ 10,000)`);
}

async function countWhere(where: SQL | undefined) {
  const [{ n }] = await db.select({ n: count() }).from(schema.customers).where(where);
  return n;
}

main().catch((err) => {
  console.error("\n✗ seed failed:", err);
  process.exit(1);
});
