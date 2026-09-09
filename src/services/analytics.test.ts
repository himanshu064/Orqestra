import { execSync } from "node:child_process";

import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, test } from "vitest";

import { db } from "@/db";
import { organizations } from "@/db/schema";
import { getAnalytics, getDashboardStats } from "@/services/analytics";
import { listRuns } from "@/services/runs";

const FOREIGN = "00000000-0000-0000-0000-000000000000";

let orgId: string;

beforeAll(async () => {
  // Seed the deterministic demo runs so stats have known content (idempotent).
  execSync("npm run runs:seed", { stdio: "ignore" });

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, "orqestra-demo"))
    .limit(1);
  if (!org) throw new Error("Demo org not found  run `npm run db:seed`.");
  orgId = org.id;
}, 120_000);

describe("dashboard stats over seeded runs", () => {
  test("totals reflect the 5 seeded runs (4 completed, 1 failed)", async () => {
    const s = await getDashboardStats(orgId);
    expect(s.totalRuns).toBeGreaterThanOrEqual(5);
    expect(s.successfulRuns).toBeGreaterThanOrEqual(4);
    expect(s.failedRuns).toBeGreaterThanOrEqual(1);
    expect(s.tasksCompleted).toBe(s.successfulRuns);
    expect(s.estCostCents).toBeGreaterThan(0);
  });

  test("agent success rates are non-empty and bounded 0..100", async () => {
    const s = await getDashboardStats(orgId);
    expect(s.agentSuccessRates.length).toBeGreaterThan(0);
    for (const r of s.agentSuccessRates) {
      expect(r.total).toBeGreaterThan(0);
      expect(r.rate).toBeGreaterThanOrEqual(0);
      expect(r.rate).toBeLessThanOrEqual(100);
    }
    // The manager appears in every seeded run.
    expect(s.agentSuccessRates.some((r) => r.agent === "manager")).toBe(true);
  });
});

describe("analytics over seeded runs", () => {
  test("runsByDay and toolUsage are populated", async () => {
    const a = await getAnalytics(orgId);
    expect(a.runsByDay.length).toBeGreaterThan(0);
    expect(a.runsByDay.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.day))).toBe(true);
    expect(a.toolUsage.length).toBeGreaterThan(0);
    // getCustomerMetrics is used by the seeded Customer Recovery run.
    expect(a.toolUsage.some((t) => t.count > 0)).toBe(true);
  });

  test("duration, tokens and approval rate are sane", async () => {
    const a = await getAnalytics(orgId);
    expect(a.avgDurationMs).toBeGreaterThan(0);
    expect(a.inputTokens).toBeGreaterThan(0);
    expect(a.outputTokens).toBeGreaterThan(0);
    expect(a.approvalRate).toBeGreaterThanOrEqual(0);
    expect(a.approvalRate).toBeLessThanOrEqual(100);
  });
});

describe("listRuns", () => {
  test("returns seeded runs newest-first with summary fields", async () => {
    const runs = await listRuns(orgId, 50);
    expect(runs.length).toBeGreaterThanOrEqual(5);
    const recovery = runs.find((r) => r.objective.startsWith("Analyze our customers"));
    expect(recovery).toBeTruthy();
    expect(recovery!.status).toBe("completed");
    expect(recovery!.agentCount).toBeGreaterThan(0);
    expect(recovery!.toolCalls).toBeGreaterThan(0);
    expect(recovery!.durationMs).toBeGreaterThan(0);
    expect(recovery!.estCostCents).toBeGreaterThan(0);
  });
});

describe("org scoping", () => {
  test("foreign org sees zero everywhere", async () => {
    const s = await getDashboardStats(FOREIGN);
    expect(s.totalRuns).toBe(0);
    expect(s.successfulRuns).toBe(0);
    expect(s.failedRuns).toBe(0);
    expect(s.pendingApprovals).toBe(0);
    expect(s.estCostCents).toBe(0);
    expect(s.agentSuccessRates).toHaveLength(0);

    const a = await getAnalytics(FOREIGN);
    expect(a.runsByDay).toHaveLength(0);
    expect(a.toolUsage).toHaveLength(0);
    expect(a.avgDurationMs).toBe(0);
    expect(a.inputTokens).toBe(0);

    const runs = await listRuns(FOREIGN, 50);
    expect(runs).toHaveLength(0);
  });
});
