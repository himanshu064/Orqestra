import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, test } from "vitest";

import { db } from "@/db";
import { organizations } from "@/db/schema";

import { runAnalytics } from "./analytics-tools";
import type { ToolContext } from "./context";
import { queryCustomer, queryCustomers, queryCustomerMetrics } from "./customer-tools";
import { buildDataAnalystTools } from "./registry";
import { queryInvoices, queryOrders, querySubscriptions } from "./sales-tools";
import { querySupportTickets } from "./support-tools";

let ctx: ToolContext;
const FOREIGN: ToolContext = {
  organizationId: "00000000-0000-0000-0000-000000000000",
  userId: "00000000-0000-0000-0000-000000000000",
};

beforeAll(async () => {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, "orqestra-demo"))
    .limit(1);
  if (!org) throw new Error("Demo org not found  run `npm run db:seed` first.");
  ctx = { organizationId: org.id, userId: "test-user" };
});

describe("getCustomerMetrics", () => {
  test("reproduces the showcase numbers", async () => {
    const m = await queryCustomerMetrics(ctx);
    expect(m.customersAnalyzed).toBe(2481);
    expect(m.highRiskCustomers).toBe(137);
    expect(m.highValueAtRisk).toBe(42);
    expect(m.recoveryOpportunity).toBe(184_500);
    expect(m.churnedCount).toBe(100);
    expect(m.recoveredCount).toBe(42);
    expect(m.avgHealthScore).toBeGreaterThan(0);
  });
});

describe("getCustomers", () => {
  test("filters by status and bounds the result", async () => {
    const r = await queryCustomers(ctx, { status: "at_risk", limit: 5 });
    expect(r.total).toBe(137);
    expect(r.returned).toBe(5);
    expect(r.customers.every((c) => c.status === "at_risk")).toBe(true);
  });

  test("high-value-at-risk filter matches the 42 cohort", async () => {
    const r = await queryCustomers(ctx, {
      status: "at_risk",
      minMrr: 2000,
      maxUsageChangePct: -30,
      limit: 200,
    });
    expect(r.total).toBe(42);
    expect(r.customers.every((c) => c.mrr >= 2000 && c.usageChangePct <= -30)).toBe(true);
  });
});

describe("getCustomer", () => {
  test("resolves by external ref, returns null for unknown", async () => {
    const found = await queryCustomer(ctx, { externalRef: "CUS-1001" });
    expect(found?.externalRef).toBe("CUS-1001");
    const missing = await queryCustomer(ctx, { externalRef: "CUS-DOES-NOT-EXIST" });
    expect(missing).toBeNull();
  });
});

describe("sales tools", () => {
  test("getOrders sees 10k+ orders", async () => {
    const r = await queryOrders(ctx, { limit: 1 });
    expect(r.total).toBeGreaterThan(10_000);
    expect(r.returned).toBe(1);
  });

  test("getInvoices finds overdue and failed invoices", async () => {
    const overdue = await queryInvoices(ctx, { status: "overdue", limit: 1 });
    const failed = await queryInvoices(ctx, { status: "failed", limit: 1 });
    expect(overdue.total).toBeGreaterThan(0);
    expect(failed.total).toBeGreaterThan(0);
  });

  test("getSubscriptions returns one per customer", async () => {
    const r = await querySubscriptions(ctx, { limit: 1 });
    expect(r.total).toBe(2481);
  });
});

describe("getSupportTickets", () => {
  test("finds open tickets", async () => {
    const r = await querySupportTickets(ctx, { status: "open", limit: 1 });
    expect(r.total).toBeGreaterThan(0);
  });
});

describe("runAnalytics", () => {
  test("customers grouped by status sums to the total, at_risk = 137", async () => {
    const r = await runAnalytics(ctx, { metric: "customers", groupBy: "status" });
    const sum = r.rows.reduce((s, row) => s + row.count, 0);
    expect(sum).toBe(2481);
    expect(r.rows.find((row) => row.key === "at_risk")?.count).toBe(137);
  });

  test("overdue_amount returns a positive dollar value", async () => {
    const r = await runAnalytics(ctx, { metric: "overdue_amount" });
    expect(r.rows[0]!.value).toBeGreaterThan(0);
  });
});

describe("org scoping", () => {
  test("a foreign org id sees no data", async () => {
    const m = await queryCustomerMetrics(FOREIGN);
    expect(m.customersAnalyzed).toBe(0);
    const c = await queryCustomers(FOREIGN, {});
    expect(c.total).toBe(0);
    const o = await queryOrders(FOREIGN, {});
    expect(o.total).toBe(0);
  });
});

describe("registry", () => {
  test("data_analyst toolset exposes all 8 tools", () => {
    const tools = buildDataAnalystTools(ctx);
    expect(Object.keys(tools).sort()).toEqual(
      [
        "getCustomer",
        "getCustomerMetrics",
        "getCustomers",
        "getInvoices",
        "getOrders",
        "getSubscriptions",
        "getSupportTickets",
        "runAnalytics",
      ].sort(),
    );
  });
});
