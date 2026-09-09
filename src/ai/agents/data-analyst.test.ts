import { describe, expect, test } from "vitest";

import { dataAnalystFindingsSchema, extractToolCalls } from "./data-analyst";

describe("dataAnalystFindingsSchema", () => {
  test("parses a valid findings object", () => {
    const sample = {
      summary: "42 high-value customers are at risk.",
      metrics: {
        customersAnalyzed: 2481,
        highRiskCustomers: 137,
        highValueAtRisk: 42,
        recoveryOpportunity: 184_500,
      },
      highlightedCustomers: [
        {
          externalRef: "CUS-1042",
          name: "Jane Doe",
          company: "Acme",
          mrr: 4200,
          usageChangePct: -45,
          riskLevel: "high",
          reason: "Usage down 45% over 60 days",
        },
      ],
      recommendations: ["Send a recovery offer to the top 42 accounts."],
    };
    expect(dataAnalystFindingsSchema.parse(sample)).toEqual(sample);
  });

  test("rejects an object missing required metrics", () => {
    expect(() => dataAnalystFindingsSchema.parse({ summary: "x" })).toThrow();
  });
});

describe("extractToolCalls", () => {
  test("pairs tool calls with their results by call id", () => {
    const steps = [
      {
        toolCalls: [{ toolName: "getCustomerMetrics", toolCallId: "a", input: {} }],
        toolResults: [{ toolCallId: "a", output: { customersAnalyzed: 2481 } }],
      },
      {
        toolCalls: [{ toolName: "getCustomers", toolCallId: "b", input: { status: "at_risk" } }],
        toolResults: [{ toolCallId: "b", output: { total: 137 } }],
      },
    ];
    expect(extractToolCalls(steps)).toEqual([
      { tool: "getCustomerMetrics", input: {}, output: { customersAnalyzed: 2481 } },
      { tool: "getCustomers", input: { status: "at_risk" }, output: { total: 137 } },
    ]);
  });

  test("handles a tool call with no matching result", () => {
    const steps = [{ toolCalls: [{ toolName: "x", toolCallId: "z", input: 1 }] }];
    expect(extractToolCalls(steps)[0]!.output).toBeUndefined();
  });
});
