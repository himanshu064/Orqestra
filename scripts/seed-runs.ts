import "dotenv/config";

import { and, eq, inArray, sql } from "drizzle-orm";

import type { AgentKey } from "@/ai/tools/registry";
import { db } from "@/db";
import {
  agentRuns,
  agentSteps,
  approvals,
  auditLogs,
  organizations,
  toolCalls,
  users,
} from "@/db/schema";
import { estimateCostCents } from "@/lib/cost";

/**
 * Seed deterministic, already-completed agent runs so the reporting screens
 * (Dashboard / Tasks / Activity / Analytics) render compelling history without a live LLM.
 * Idempotent: identifies its runs by objective and re-creates them on each run.
 */

type StepKind = "plan" | "delegate" | "tool_call" | "review" | "final";
type ExecStatus = "success" | "error";

type SeedTool = {
  agent: AgentKey;
  tool: string;
  input: unknown;
  output: unknown;
  durationMs: number;
  status?: ExecStatus;
};

type SeedStep = {
  agent: AgentKey;
  type: StepKind;
  title: string;
  status?: ExecStatus;
  output?: unknown;
};

type SeedApproval = {
  actionType: string;
  payload: unknown;
  status: "pending" | "executed" | "rejected";
  requestedByAgent: AgentKey;
};

type SeedRun = {
  objective: string;
  status: "completed" | "failed";
  dayOffset: number; // days ago the run was created
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  steps: SeedStep[];
  tools: SeedTool[];
  finalResult?: unknown;
  error?: string;
  approvals?: SeedApproval[];
};

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const SEED_MODEL = "gemini-3.6-flash";

const RUNS: SeedRun[] = [
  {
    objective:
      "Analyze our customers and identify high-value accounts at risk of churn; prepare a recovery summary.",
    status: "completed",
    dayOffset: 1,
    durationMs: 42_000,
    inputTokens: 8_240,
    outputTokens: 1_460,
    steps: [
      { agent: "manager", type: "plan", title: "Plan: assess churn risk across the customer base" },
      { agent: "data_analyst", type: "delegate", title: "Data Analyst: quantify at-risk revenue" },
      { agent: "manager", type: "final", title: "Synthesize recovery recommendations" },
    ],
    tools: [
      {
        agent: "data_analyst",
        tool: "getCustomerMetrics",
        input: { segment: "all" },
        output: { total: 2481, atRisk: 137, highValueAtRisk: 42, mrr: 612400 },
        durationMs: 310,
      },
      {
        agent: "data_analyst",
        tool: "getCustomers",
        input: { status: "at_risk", riskLevel: "high", limit: 42 },
        output: { count: 42, recoveryOpportunityUsd: 184500 },
        durationMs: 540,
      },
      {
        agent: "data_analyst",
        tool: "runAnalytics",
        input: { metric: "churn_risk_by_segment" },
        output: { enterprise: 0.18, midmarket: 0.11, smb: 0.07 },
        durationMs: 420,
      },
    ],
    finalResult: {
      summary:
        "42 high-value accounts ($184,500 ARR) show high churn risk, concentrated in Enterprise. Recommend proactive outreach from CSMs within 7 days.",
      metrics: { customersAnalyzed: 2481, highValueAtRisk: 42, recoveryOpportunityUsd: 184500 },
      agentsInvolved: ["manager", "data_analyst"],
    },
  },
  {
    objective:
      "Find overdue invoices for at-risk enterprise accounts and draft recovery outreach for the largest balances.",
    status: "completed",
    dayOffset: 3,
    durationMs: 58_000,
    inputTokens: 11_920,
    outputTokens: 2_180,
    steps: [
      { agent: "manager", type: "plan", title: "Plan: recover overdue enterprise revenue" },
      { agent: "data_analyst", type: "delegate", title: "Data Analyst: rank overdue invoices" },
      { agent: "communication", type: "delegate", title: "Communication: draft recovery emails" },
      { agent: "manager", type: "final", title: "Compile outreach plan for approval" },
    ],
    tools: [
      {
        agent: "data_analyst",
        tool: "getInvoices",
        input: { status: "overdue", segment: "enterprise" },
        output: { count: 18, totalOverdueUsd: 96200, largestUsd: 24800 },
        durationMs: 380,
      },
      {
        agent: "data_analyst",
        tool: "getCustomerContact",
        input: { customerId: "cus_enterprise_top" },
        output: { name: "Dana Whitfield", email: "billing@northwind.example", role: "AP Manager" },
        durationMs: 210,
      },
      {
        agent: "communication",
        tool: "draftEmail",
        input: { to: "billing@northwind.example", topic: "overdue_invoice", balanceUsd: 24800 },
        output: {
          subject: "Overdue invoice #INV-2231  let's get this resolved",
          preview: "Hi Dana, our records show invoice #INV-2231 ($24,800) is now 34 days past due…",
        },
        durationMs: 1_650,
      },
    ],
    finalResult: {
      summary:
        "18 overdue enterprise invoices totaling $96,200. Drafted recovery emails for the top 3 balances ($61,400 combined); largest is $24,800. Sending requires approval.",
      metrics: { overdueInvoices: 18, totalOverdueUsd: 96200, emailsDrafted: 3 },
      agentsInvolved: ["manager", "data_analyst", "communication"],
    },
    approvals: [
      {
        actionType: "send_email",
        payload: {
          to: "billing@northwind.example",
          subject: "Overdue invoice #INV-2231  let's get this resolved",
        },
        status: "executed",
        requestedByAgent: "communication",
      },
      {
        actionType: "send_email",
        payload: { to: "ap@globex.example", subject: "Following up on invoice #INV-2244" },
        status: "pending",
        requestedByAgent: "communication",
      },
    ],
  },
  {
    objective:
      "Summarize this quarter's sales performance and benchmark it against current SaaS industry trends.",
    status: "completed",
    dayOffset: 5,
    durationMs: 67_000,
    inputTokens: 13_500,
    outputTokens: 2_640,
    steps: [
      { agent: "manager", type: "plan", title: "Plan: quarterly performance + external benchmark" },
      { agent: "data_analyst", type: "delegate", title: "Data Analyst: compute quarterly metrics" },
      { agent: "research", type: "delegate", title: "Research: gather industry benchmarks" },
      { agent: "manager", type: "final", title: "Synthesize benchmarked summary" },
    ],
    tools: [
      {
        agent: "data_analyst",
        tool: "getOrders",
        input: { period: "current_quarter" },
        output: { orders: 1043, revenueUsd: 1284000, growthQoQ: 0.14 },
        durationMs: 460,
      },
      {
        agent: "data_analyst",
        tool: "getSubscriptions",
        input: { status: "active" },
        output: { active: 1912, netRevenueRetention: 1.09 },
        durationMs: 300,
      },
      {
        agent: "research",
        tool: "webSearch",
        input: { query: "SaaS median net revenue retention 2026 benchmark" },
        output: { medianNRR: 1.06, source: "industry benchmark report" },
        durationMs: 2_100,
      },
      {
        agent: "research",
        tool: "searchKnowledgeBase",
        input: { query: "our historical NRR targets" },
        output: { targetNRR: 1.1, note: "FY26 board target" },
        durationMs: 180,
      },
    ],
    finalResult: {
      summary:
        "Q revenue $1.28M (+14% QoQ), NRR 1.09  above the 1.06 SaaS median but just short of our 1.10 board target. Expansion is healthy; focus on reducing SMB churn to close the gap.",
      metrics: { revenueUsd: 1284000, growthQoQ: 0.14, nrr: 1.09, industryMedianNrr: 1.06 },
      agentsInvolved: ["manager", "data_analyst", "research"],
    },
  },
  {
    objective:
      "Investigate the spike in support tickets from mid-market accounts this week and identify the root cause.",
    status: "completed",
    dayOffset: 6,
    durationMs: 39_000,
    inputTokens: 7_100,
    outputTokens: 1_240,
    steps: [
      { agent: "manager", type: "plan", title: "Plan: triage support ticket spike" },
      { agent: "data_analyst", type: "delegate", title: "Data Analyst: cluster recent tickets" },
      { agent: "manager", type: "final", title: "Report likely root cause" },
    ],
    tools: [
      {
        agent: "data_analyst",
        tool: "getSupportTickets",
        input: { period: "last_7_days", segment: "midmarket" },
        output: { total: 214, openRate: 0.31, topTag: "sso_login_failure" },
        durationMs: 350,
      },
      {
        agent: "data_analyst",
        tool: "searchSupportTickets",
        input: { query: "SSO login failure after update" },
        output: { matches: 88, firstSeen: "2026-09-02" },
        durationMs: 520,
      },
    ],
    finalResult: {
      summary:
        "214 mid-market tickets this week; 41% cluster on 'sso_login_failure' starting Sep 2, correlating with the SSO provider config change. Recommend rollback + status-page notice.",
      metrics: { tickets: 214, ssoFailureShare: 0.41 },
      agentsInvolved: ["manager", "data_analyst"],
    },
  },
  {
    objective:
      "Research competitor pricing changes and draft a positioning brief for the sales team.",
    status: "failed",
    dayOffset: 8,
    durationMs: 14_000,
    inputTokens: 3_200,
    outputTokens: 210,
    steps: [
      { agent: "manager", type: "plan", title: "Plan: competitor pricing scan" },
      {
        agent: "research",
        type: "delegate",
        title: "Research: fetch competitor pricing",
        status: "error",
      },
    ],
    tools: [
      {
        agent: "research",
        tool: "webSearch",
        input: { query: "competitor X enterprise pricing 2026" },
        output: { error: "rate_limited" },
        durationMs: 1_900,
        status: "error",
      },
    ],
    error: "Research agent exceeded provider rate limit before completing the pricing scan.",
  },
];

const SEED_OBJECTIVES = RUNS.map((r) => r.objective);

async function main() {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, "orqestra-demo"))
    .limit(1);
  if (!org) throw new Error("Demo org not found  run `npm run db:seed` first.");

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, "manager@orqestra.demo"))
    .limit(1);
  if (!user) throw new Error("Demo user not found  run `npm run db:seed` first.");

  // Idempotent: remove prior seeded runs (cascades to steps / tool_calls / approvals).
  const existing = await db
    .select({ id: agentRuns.id })
    .from(agentRuns)
    .where(and(eq(agentRuns.organizationId, org.id), inArray(agentRuns.objective, SEED_OBJECTIVES)));
  if (existing.length) {
    await db.delete(agentRuns).where(
      inArray(
        agentRuns.id,
        existing.map((r) => r.id),
      ),
    );
    console.log(`  Cleared ${existing.length} prior seeded run(s).`);
  }
  // Audit rows aren't FK-linked to runs; clear the seeded ones so re-seeding stays idempotent.
  await db
    .delete(auditLogs)
    .where(
      and(eq(auditLogs.organizationId, org.id), sql`${auditLogs.metadata} ->> 'seed' = 'true'`),
    );

  let totalSteps = 0;
  let totalTools = 0;
  let totalApprovals = 0;

  // Deterministic clock anchored to "now" so history looks recent but stable within a run.
  const now = Date.now();

  for (const spec of RUNS) {
    const createdAt = new Date(now - spec.dayOffset * DAY);
    const startedAt = createdAt;
    const completedAt = new Date(startedAt.getTime() + spec.durationMs);

    const [run] = await db
      .insert(agentRuns)
      .values({
        organizationId: org.id,
        userId: user.id,
        objective: spec.objective,
        status: spec.status,
        model: SEED_MODEL,
        stopReason: spec.status === "failed" ? "error" : "completed",
        startedAt,
        completedAt,
        totalSteps: spec.steps.length,
        totalToolCalls: spec.tools.length,
        inputTokens: spec.inputTokens,
        outputTokens: spec.outputTokens,
        estimatedCostCents: estimateCostCents(SEED_MODEL, spec.inputTokens, spec.outputTokens),
        finalResult: spec.finalResult ?? null,
        error: spec.error ?? null,
        createdAt,
      })
      .returning({ id: agentRuns.id });
    const runId = run!.id;

    // Steps  timeline spread evenly across the run window.
    const stepGap = spec.durationMs / (spec.steps.length + 1);
    const stepIds: string[] = [];
    for (let i = 0; i < spec.steps.length; i++) {
      const s = spec.steps[i]!;
      const stepStart = new Date(startedAt.getTime() + stepGap * i);
      const stepEnd = new Date(startedAt.getTime() + stepGap * (i + 1));
      const [stepRow] = await db
        .insert(agentSteps)
        .values({
          runId,
          organizationId: org.id,
          agent: s.agent,
          stepIndex: i,
          type: s.type,
          title: s.title,
          output: s.output ?? null,
          status: s.status ?? "success",
          startedAt: stepStart,
          completedAt: stepEnd,
        })
        .returning({ id: agentSteps.id });
      stepIds.push(stepRow!.id);
      totalSteps++;
    }

    // Tool calls  attach to the first step owned by the same agent.
    const firstStepByAgent = new Map<AgentKey, string>();
    spec.steps.forEach((s, i) => {
      if (!firstStepByAgent.has(s.agent)) firstStepByAgent.set(s.agent, stepIds[i]!);
    });
    let toolClock = startedAt.getTime() + stepGap;
    for (const t of spec.tools) {
      await db.insert(toolCalls).values({
        runId,
        stepId: firstStepByAgent.get(t.agent) ?? null,
        organizationId: org.id,
        agent: t.agent,
        tool: t.tool,
        input: t.input,
        output: t.output,
        status: t.status ?? "success",
        durationMs: t.durationMs,
        createdAt: new Date(toolClock),
      });
      toolClock += t.durationMs + 500;
      totalTools++;
    }

    // Approvals (optional) + their immutable audit entries (§38).
    for (let i = 0; i < (spec.approvals?.length ?? 0); i++) {
      const a = spec.approvals![i]!;
      const decided = a.status !== "pending";
      const [approval] = await db
        .insert(approvals)
        .values({
          organizationId: org.id,
          runId,
          actionType: a.actionType,
          payload: a.payload as object,
          status: a.status,
          requestedByAgent: a.requestedByAgent,
          decidedByUserId: decided ? user.id : null,
          decidedAt: decided ? completedAt : null,
          executedAt: a.status === "executed" ? completedAt : null,
          executionResult:
            a.status === "executed" ? { ok: true, provider: "mock", messageId: `seed-${i}` } : null,
          idempotencyKey: `seed:${runId}:${i}`,
          createdAt,
        })
        .returning({ id: approvals.id });
      totalApprovals++;

      if (decided) {
        await db.insert(auditLogs).values({
          organizationId: org.id,
          actorType: "user",
          actorId: user.id,
          action: a.status === "executed" ? "approval.executed" : "approval.rejected",
          targetType: "approval",
          targetId: approval!.id,
          result: a.status === "executed" ? "success" : "rejected",
          metadata: { seed: true, actionType: a.actionType },
          createdAt: completedAt,
        });
      }
    }

    console.log(`  ✓ ${spec.status.padEnd(9)} ${spec.objective.slice(0, 64)}…`);
  }

  console.log(
    `\n✅ Seeded ${RUNS.length} runs · ${totalSteps} steps · ${totalTools} tool calls · ${totalApprovals} approvals.`,
  );
}

main().catch((err) => {
  console.error("✗ seed-runs failed:", err);
  process.exit(1);
});
