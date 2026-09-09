import { generateObject, generateText, stepCountIs, tool } from "ai";
import { z } from "zod";

import type { GuardrailTracker } from "@/ai/guardrails";
import type { AgentKey } from "@/ai/tools/registry";
import { resolveModel } from "@/ai/provider";
import { MANAGER_SYSTEM } from "@/ai/prompts/manager";
import type { ToolContext } from "@/ai/tools/context";
import { toClientError } from "@/lib/errors";
import type { RunRecorder } from "@/services/run-recorder";

import { runCommunication, type CommunicationResult } from "./communication";
import { runDataAnalyst, type DataAnalystFindings } from "./data-analyst";
import { runResearch, type ResearchFindings } from "./research";
import type { AgentResult } from "./types";

/** Consolidated run report the Manager produces (stored in agent_runs.final_result). */
export const managerReportSchema = z.object({
  summary: z.string().describe("Executive summary of what was found and recommended"),
  metrics: z.object({
    customersAnalyzed: z.number(),
    highRiskCustomers: z.number(),
    highValueAtRisk: z.number(),
    recoveryOpportunity: z.number(),
  }),
  /** Scenario-adaptive headline metrics - what matters for THIS objective (§41). */
  keyMetrics: z
    .array(z.object({ label: z.string(), value: z.string() }))
    .describe(
      "3–5 headline metrics most relevant to THIS objective, each a short label + already-formatted value " +
        '(e.g. {label:"Overdue invoices", value:"32"}, {label:"Outstanding", value:"$222,473"}). Empty array if none apply.',
    ),
  highlights: z.array(
    z.object({
      externalRef: z.string(),
      name: z.string(),
      mrr: z.number(),
      usageChangePct: z.number(),
      reason: z.string(),
    }),
  ),
  recommendations: z.array(z.string()),
  agentsInvolved: z.array(z.string()),
});

export type ManagerReport = z.infer<typeof managerReportSchema>;

export async function runManager(
  ctx: ToolContext,
  objective: string,
  recorder: RunRecorder,
  opts?: { maxSteps?: number; maxRetries?: number; guard?: GuardrailTracker },
): Promise<ManagerReport> {
  const model = await resolveModel(ctx.organizationId);
  const maxRetries = opts?.maxRetries ?? 6;
  const guard = opts?.guard;

  let lastFindings: DataAnalystFindings | null = null;
  let lastResearch: ResearchFindings | null = null;
  let lastComms: CommunicationResult | null = null;

  // Shared delegation protocol: hop-guard → agentStarted → run → account usage → agentCompleted,
  // with agentFailed on error. Each specialist only differs by its key, description, and run fn.
  function makeDelegateTool<T extends { summary: string }>(config: {
    agent: AgentKey;
    description: string;
    hint: string;
    run: (sub: string, stepId: string) => Promise<AgentResult<T>>;
    onResult: (findings: T) => void;
  }) {
    return tool({
      description: config.description,
      inputSchema: z.object({ objective: z.string().describe(config.hint) }),
      execute: async ({ objective: sub }): Promise<Record<string, unknown>> => {
        guard?.recordHop();
        // Each invocation owns its step id - concurrent same-agent delegations don't collide.
        const stepId = await recorder.agentStarted(config.agent, sub, "delegate");
        try {
          const res = await config.run(sub, stepId);
          recorder.addUsage(res.usage.inputTokens, res.usage.outputTokens);
          config.onResult(res.findings);
          await recorder.agentCompleted(config.agent, stepId, res.findings.summary, res.findings);
          return res.findings as Record<string, unknown>;
        } catch (err) {
          // Log raw server-side; surface a safe message to the client stream.
          console.error(`[agent:${config.agent}] failed`, err);
          await recorder.agentFailed(config.agent, stepId, toClientError(err));
          throw err;
        }
      },
    });
  }

  const delegateToDataAnalyst = makeDelegateTool({
    agent: "data_analyst",
    description:
      "Delegate a data-analysis sub-task to the Data Analyst agent. Provide a clear objective; returns structured findings (metrics, at-risk customers, recommendations).",
    hint: "What the Data Analyst should investigate",
    run: (sub, stepId) =>
      runDataAnalyst(ctx, sub, {
        guard,
        onStep: (s) => recorder.recordStep("data_analyst", stepId, s),
      }),
    onResult: (f) => (lastFindings = f),
  });

  const delegateToResearch = makeDelegateTool({
    agent: "research",
    description:
      "Delegate a research sub-task to the Research Agent. Use for policy/knowledge-base questions or to investigate a specific customer's history. Returns sourced findings.",
    hint: "What the Research Agent should investigate",
    run: (sub, stepId) =>
      runResearch(ctx, sub, { guard, onStep: (s) => recorder.recordStep("research", stepId, s) }),
    onResult: (f) => (lastResearch = f),
  });

  const delegateToCommunication = makeDelegateTool({
    agent: "communication",
    description:
      "Delegate communication tasks (drafting and queuing personalized emails or CRM tasks) to the Communication Agent. Sensitive actions are queued for human approval, never sent automatically.",
    hint: "What the Communication Agent should prepare",
    run: (sub, stepId) =>
      runCommunication(ctx, sub, recorder, {
        guard,
        onStep: (s) => recorder.recordStep("communication", stepId, s),
      }),
    onResult: (f) => (lastComms = f),
  });

  const managerStepId = await recorder.agentStarted("manager", "Planning and delegating", "plan");

  // Phase 1  plan + delegate.
  const gen = await generateText({
    model,
    system: MANAGER_SYSTEM,
    prompt: objective,
    tools: { delegateToDataAnalyst, delegateToResearch, delegateToCommunication },
    stopWhen: stepCountIs(opts?.maxSteps ?? 5),
    maxRetries,
    onStepFinish: (step) => recorder.recordStep("manager", managerStepId, step),
  });
  guard?.throwIfTripped();
  // Count the Manager's planning/tool phase once (recordStep no longer accrues usage).
  recorder.addUsage(gen.totalUsage?.inputTokens, gen.totalUsage?.outputTokens);

  // Phase 2  consolidate into the final report.
  const structured = await generateObject({
    model,
    schema: managerReportSchema,
    system:
      "You are the Manager. Consolidate the specialist findings into a final report. Use ONLY facts/numbers already established below (metrics come from the Data Analyst; if none ran, use 0). " +
      "Populate keyMetrics with the 3–5 numbers most relevant to THIS objective (e.g. overdue-invoice count + outstanding $ for an invoice task; revenue + growth for a sales task; at-risk accounts + ARR for churn), each value already formatted as a string. " +
      "agentsInvolved must list the specialists that actually contributed (always include 'Manager').",
    prompt: [
      `Objective:\n${objective}`,
      `\nYour review/plan:\n${gen.text || "(none)"}`,
      `\nData Analyst findings (JSON):\n${JSON.stringify(lastFindings).slice(0, 4000)}`,
      `\nResearch findings (JSON):\n${JSON.stringify(lastResearch).slice(0, 3000)}`,
      `\nCommunication result (JSON):\n${JSON.stringify(lastComms).slice(0, 3000)}`,
      `\nProduce the final consolidated report.`,
    ].join("\n"),
    maxRetries,
  });
  guard?.throwIfTripped();
  recorder.addUsage(structured.usage?.inputTokens, structured.usage?.outputTokens);

  await recorder.agentCompleted("manager", managerStepId, structured.object.summary);

  return structured.object;
}
