import { describe, expect, test } from "vitest";

import type { AgentEvent } from "@/ai/events";

import { reduceActivity } from "./agent-activity";

const at = "2026-09-08T00:00:00.000Z";
const report = {
  summary: "42 high-value accounts at risk.",
  metrics: {
    customersAnalyzed: 2481,
    highRiskCustomers: 137,
    highValueAtRisk: 42,
    recoveryOpportunity: 184_500,
  },
  keyMetrics: [{ label: "High-value at risk", value: "42" }],
  highlights: [],
  recommendations: ["Reach out to the top 42 accounts."],
  agentsInvolved: ["Manager", "Data Analyst"],
};

describe("reduceActivity", () => {
  test("idle with no events", () => {
    expect(reduceActivity([]).status).toBe("idle");
  });

  test("folds a completed multi-agent run", () => {
    const events: AgentEvent[] = [
      { type: "run.started", runId: "r1", at, objective: "Analyze churn" },
      { type: "agent.started", runId: "r1", at, agent: "manager" },
      { type: "agent.started", runId: "r1", at, agent: "data_analyst" },
      {
        type: "tool.completed",
        runId: "r1",
        at,
        agent: "data_analyst",
        tool: "getCustomerMetrics",
        status: "success",
        durationMs: 5,
      },
      {
        type: "tool.completed",
        runId: "r1",
        at,
        agent: "data_analyst",
        tool: "getCustomers",
        status: "success",
        durationMs: 8,
      },
      { type: "agent.completed", runId: "r1", at, agent: "data_analyst" },
      { type: "agent.completed", runId: "r1", at, agent: "manager" },
      {
        type: "run.completed",
        runId: "r1",
        at,
        result: report,
        totals: { steps: 2, toolCalls: 2 },
      },
    ];

    const s = reduceActivity(events);
    expect(s.status).toBe("completed");
    expect(s.runId).toBe("r1");
    expect(s.objective).toBe("Analyze churn");
    expect(s.agents.map((a) => a.key)).toEqual(["manager", "data_analyst"]);
    expect(s.agents.every((a) => a.status === "success")).toBe(true);

    const analyst = s.agents.find((a) => a.key === "data_analyst")!;
    expect(analyst.toolCalls.map((t) => t.tool)).toEqual(["getCustomerMetrics", "getCustomers"]);

    expect(s.report?.metrics.customersAnalyzed).toBe(2481);
    expect(s.totals).toEqual({ steps: 2, toolCalls: 2 });
  });

  test("folds a failed run", () => {
    const events: AgentEvent[] = [
      { type: "run.started", runId: "r2", at, objective: "x" },
      { type: "agent.started", runId: "r2", at, agent: "manager" },
      { type: "agent.started", runId: "r2", at, agent: "data_analyst" },
      { type: "agent.failed", runId: "r2", at, agent: "data_analyst", error: "quota exceeded" },
      { type: "run.failed", runId: "r2", at, error: "quota exceeded" },
    ];

    const s = reduceActivity(events);
    expect(s.status).toBe("failed");
    expect(s.error).toBe("quota exceeded");
    expect(s.agents.find((a) => a.key === "data_analyst")?.status).toBe("error");
  });
});
