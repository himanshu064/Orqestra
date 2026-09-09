import { generateObject, generateText, stepCountIs } from "ai";
import { z } from "zod";

import type { GuardrailTracker } from "@/ai/guardrails";
import { resolveModel } from "@/ai/provider";
import { ANALYST_SYSTEM } from "@/ai/prompts/analyst";
import { buildToolset } from "@/ai/tools/registry";
import type { ToolContext } from "@/ai/tools/context";

import type { AgentResult, StepLike, ToolCallTrace } from "./types";

/** Structured findings the Data Analyst returns (§9/§28). Kept flat + required for
 *  broad provider compatibility (Gemini/OpenAI/Anthropic structured output). */
export const dataAnalystFindingsSchema = z.object({
  summary: z.string().describe("1–3 sentence data-driven summary"),
  metrics: z.object({
    customersAnalyzed: z.number(),
    highRiskCustomers: z.number(),
    highValueAtRisk: z.number(),
    recoveryOpportunity: z.number().describe("Total at-risk MRR, in dollars"),
  }),
  highlightedCustomers: z
    .array(
      z.object({
        externalRef: z.string(),
        name: z.string(),
        company: z.string(),
        mrr: z.number(),
        usageChangePct: z.number(),
        riskLevel: z.string(),
        reason: z.string(),
      }),
    )
    .describe("Notable at-risk accounts worth acting on"),
  recommendations: z.array(z.string()),
});

export type DataAnalystFindings = z.infer<typeof dataAnalystFindingsSchema>;

// --- trace extraction (testable without the model) ----------------------------
export function extractToolCalls(steps: readonly StepLike[]): ToolCallTrace[] {
  const traces: ToolCallTrace[] = [];
  for (const step of steps) {
    const outputByCallId = new Map<string, unknown>();
    for (const r of step.toolResults ?? []) outputByCallId.set(r.toolCallId, r.output);
    for (const c of step.toolCalls ?? []) {
      traces.push({ tool: c.toolName, input: c.input, output: outputByCallId.get(c.toolCallId) });
    }
  }
  return traces;
}

// --- the agent ----------------------------------------------------------------
export async function runDataAnalyst(
  ctx: ToolContext,
  objective: string,
  opts?: {
    maxSteps?: number;
    maxRetries?: number;
    /** Called after each finished step so the caller can stream/persist tool activity. */
    onStep?: (step: StepLike) => void | Promise<void>;
    /** Enforces per-agent tool-call cap + per-tool timeout when provided (§35). */
    guard?: GuardrailTracker;
  },
): Promise<AgentResult<DataAnalystFindings>> {
  const model = await resolveModel(ctx.organizationId);
  const base = buildToolset(ctx, "data_analyst");
  const tools = opts?.guard ? opts.guard.wrap(base, "data_analyst") : base;
  const maxSteps = opts?.maxSteps ?? 6;
  // Ride out provider rate limits (e.g. Gemini free tier is 5 req/min) with backoff.
  const maxRetries = opts?.maxRetries ?? 6;

  // Phase 1  analyze with tools across multiple steps.
  const gen = await generateText({
    model,
    system: ANALYST_SYSTEM,
    prompt: objective,
    tools,
    stopWhen: stepCountIs(maxSteps),
    maxRetries,
    onStepFinish: opts?.onStep ? (step) => opts.onStep!(step) : undefined,
  });
  opts?.guard?.throwIfTripped();

  const toolCalls = extractToolCalls(gen.steps);

  // Phase 2  coerce the analysis into the exact findings schema.
  const structured = await generateObject({
    model,
    schema: dataAnalystFindingsSchema,
    system:
      "You convert an analyst's work into the final structured findings. Use ONLY numbers already established in the analysis and tool results below. Do not invent customers or figures.",
    prompt: [
      `Objective:\n${objective}`,
      `\nAnalyst's written analysis:\n${gen.text || "(none)"}`,
      `\nTool results gathered (JSON):\n${JSON.stringify(toolCalls).slice(0, 6000)}`,
      `\nProduce the final structured findings.`,
    ].join("\n"),
    maxRetries,
  });
  opts?.guard?.throwIfTripped();

  const usage = {
    inputTokens: (gen.totalUsage?.inputTokens ?? 0) + (structured.usage?.inputTokens ?? 0),
    outputTokens: (gen.totalUsage?.outputTokens ?? 0) + (structured.usage?.outputTokens ?? 0),
  };

  return { findings: structured.object, toolCalls, usage, text: gen.text };
}
