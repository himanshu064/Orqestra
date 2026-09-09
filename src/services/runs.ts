import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { agentRuns, agentSteps, toolCalls } from "@/db/schema";
import { estimateCostCents } from "@/lib/cost";

export type RunSummary = {
  id: string;
  objective: string;
  status: string;
  agentCount: number;
  toolCalls: number;
  durationMs: number | null;
  inputTokens: number;
  outputTokens: number;
  estCostCents: number;
  createdAt: string;
};

function durationMs(startedAt: Date | null, completedAt: Date | null): number | null {
  if (!startedAt || !completedAt) return null;
  return Math.max(0, completedAt.getTime() - startedAt.getTime());
}

export async function listRuns(orgId: string, limit = 50): Promise<RunSummary[]> {
  const rows = await db
    .select()
    .from(agentRuns)
    .where(eq(agentRuns.organizationId, orgId))
    .orderBy(desc(agentRuns.createdAt))
    .limit(limit);

  const ids = rows.map((r) => r.id);
  const agentCounts = ids.length
    ? await db
        .select({
          runId: agentSteps.runId,
          agents: sql<number>`count(distinct ${agentSteps.agent})`,
        })
        .from(agentSteps)
        .where(inArray(agentSteps.runId, ids))
        .groupBy(agentSteps.runId)
    : [];
  const agentByRun = new Map(agentCounts.map((a) => [a.runId, Number(a.agents)]));

  return rows.map((r) => ({
    id: r.id,
    objective: r.objective,
    status: r.status,
    agentCount: agentByRun.get(r.id) ?? 0,
    toolCalls: r.totalToolCalls,
    durationMs: durationMs(r.startedAt, r.completedAt),
    inputTokens: r.inputTokens,
    outputTokens: r.outputTokens,
    estCostCents: r.estimatedCostCents || estimateCostCents(r.model, r.inputTokens, r.outputTokens),
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function recentRuns(orgId: string, n = 5): Promise<RunSummary[]> {
  return listRuns(orgId, n);
}

export async function getRunTrace(orgId: string, runId: string) {
  const [run] = await db
    .select()
    .from(agentRuns)
    .where(and(eq(agentRuns.organizationId, orgId), eq(agentRuns.id, runId)))
    .limit(1);
  if (!run) return null;

  const [steps, calls] = await Promise.all([
    db
      .select()
      .from(agentSteps)
      .where(and(eq(agentSteps.organizationId, orgId), eq(agentSteps.runId, runId)))
      .orderBy(agentSteps.stepIndex),
    db
      .select()
      .from(toolCalls)
      .where(and(eq(toolCalls.organizationId, orgId), eq(toolCalls.runId, runId)))
      .orderBy(toolCalls.createdAt),
  ]);

  return { run, steps, calls };
}
