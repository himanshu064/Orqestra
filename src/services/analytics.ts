import { count, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { agentRuns, agentSteps, approvals, toolCalls } from "@/db/schema";
import { estimateCostCents } from "@/lib/cost";

export type AgentSuccessRate = { agent: string; total: number; success: number; rate: number };

export type DashboardStats = {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  tasksCompleted: number;
  pendingApprovals: number;
  estCostCents: number;
  agentSuccessRates: AgentSuccessRate[];
};

async function agentSuccessRates(orgId: string): Promise<AgentSuccessRate[]> {
  const rows = await db
    .select({
      agent: agentSteps.agent,
      total: count(),
      success: sql<number>`count(*) filter (where ${agentSteps.status} = 'success')`,
    })
    .from(agentSteps)
    .where(eq(agentSteps.organizationId, orgId))
    .groupBy(agentSteps.agent);

  return rows
    .map((r) => {
      const total = Number(r.total);
      const success = Number(r.success);
      return { agent: r.agent, total, success, rate: total ? Math.round((success / total) * 100) : 0 };
    })
    .sort((a, b) => b.total - a.total);
}

export async function getDashboardStats(orgId: string): Promise<DashboardStats> {
  const [[runAgg], [{ pending }], rates] = await Promise.all([
    db
      .select({
        total: count(),
        completed: sql<number>`count(*) filter (where ${agentRuns.status} = 'completed')`,
        failed: sql<number>`count(*) filter (where ${agentRuns.status} = 'failed')`,
        costCents: sql<number>`coalesce(sum(${agentRuns.estimatedCostCents}), 0)`,
      })
      .from(agentRuns)
      .where(eq(agentRuns.organizationId, orgId)),
    db
      .select({ pending: sql<number>`count(*) filter (where ${approvals.status} = 'pending')` })
      .from(approvals)
      .where(eq(approvals.organizationId, orgId)),
    agentSuccessRates(orgId),
  ]);

  const completed = Number(runAgg.completed);
  return {
    totalRuns: Number(runAgg.total),
    successfulRuns: completed,
    failedRuns: Number(runAgg.failed),
    tasksCompleted: completed,
    pendingApprovals: Number(pending),
    estCostCents: Number(runAgg.costCents),
    agentSuccessRates: rates,
  };
}

export type CostSummary = { todayCents: number; monthCents: number; totalCents: number };

/** Estimated AI cost for today and this month (§40 display). */
export async function getCostSummary(orgId: string): Promise<CostSummary> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [row] = await db
    .select({
      today: sql<number>`coalesce(sum(${agentRuns.estimatedCostCents}) filter (where ${agentRuns.createdAt} >= ${startOfDay.toISOString()}), 0)`,
      month: sql<number>`coalesce(sum(${agentRuns.estimatedCostCents}) filter (where ${agentRuns.createdAt} >= ${startOfMonth.toISOString()}), 0)`,
      total: sql<number>`coalesce(sum(${agentRuns.estimatedCostCents}), 0)`,
    })
    .from(agentRuns)
    .where(eq(agentRuns.organizationId, orgId));

  return {
    todayCents: Number(row.today),
    monthCents: Number(row.month),
    totalCents: Number(row.total),
  };
}

export type Analytics = {
  runsByDay: { day: string; count: number }[];
  toolUsage: { tool: string; count: number }[];
  agentPerformance: AgentSuccessRate[];
  avgDurationMs: number;
  approvalRate: number;
  inputTokens: number;
  outputTokens: number;
  estCostCents: number;
};

export async function getAnalytics(orgId: string): Promise<Analytics> {
  const [runsByDay, toolUsage, agentPerformance, [durAgg], [apprAgg], [tokAgg]] = await Promise.all([
    db
      .select({
        day: sql<string>`to_char(${agentRuns.createdAt}, 'YYYY-MM-DD')`,
        count: count(),
      })
      .from(agentRuns)
      .where(eq(agentRuns.organizationId, orgId))
      .groupBy(sql`to_char(${agentRuns.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${agentRuns.createdAt}, 'YYYY-MM-DD')`),
    db
      .select({ tool: toolCalls.tool, count: count() })
      .from(toolCalls)
      .where(eq(toolCalls.organizationId, orgId))
      .groupBy(toolCalls.tool)
      .orderBy(desc(count()))
      .limit(10),
    agentSuccessRates(orgId),
    db
      .select({
        avgMs: sql<number>`coalesce(avg(extract(epoch from (${agentRuns.completedAt} - ${agentRuns.startedAt})) * 1000) filter (where ${agentRuns.completedAt} is not null and ${agentRuns.startedAt} is not null), 0)`,
      })
      .from(agentRuns)
      .where(eq(agentRuns.organizationId, orgId)),
    db
      .select({
        executed: sql<number>`count(*) filter (where ${approvals.status} = 'executed')`,
        rejected: sql<number>`count(*) filter (where ${approvals.status} = 'rejected')`,
      })
      .from(approvals)
      .where(eq(approvals.organizationId, orgId)),
    db
      .select({
        inTok: sql<number>`coalesce(sum(${agentRuns.inputTokens}), 0)`,
        outTok: sql<number>`coalesce(sum(${agentRuns.outputTokens}), 0)`,
        costCents: sql<number>`coalesce(sum(${agentRuns.estimatedCostCents}), 0)`,
      })
      .from(agentRuns)
      .where(eq(agentRuns.organizationId, orgId)),
  ]);

  const executed = Number(apprAgg.executed);
  const decided = executed + Number(apprAgg.rejected);
  const inputTokens = Number(tokAgg.inTok);
  const outputTokens = Number(tokAgg.outTok);
  const costCents = Number(tokAgg.costCents);

  return {
    runsByDay: runsByDay.map((r) => ({ day: r.day, count: Number(r.count) })),
    toolUsage: toolUsage.map((t) => ({ tool: t.tool, count: Number(t.count) })),
    agentPerformance,
    avgDurationMs: Math.round(Number(durAgg.avgMs)),
    approvalRate: decided ? Math.round((executed / decided) * 100) : 0,
    inputTokens,
    outputTokens,
    estCostCents: costCents || estimateCostCents(inputTokens, outputTokens),
  };
}
