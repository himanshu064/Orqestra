import { generateObject, generateText, stepCountIs } from "ai";
import { z } from "zod";

import type { GuardrailTracker } from "@/ai/guardrails";
import { resolveModel } from "@/ai/provider";
import { RESEARCH_SYSTEM } from "@/ai/prompts/research";
import { buildToolset } from "@/ai/tools/registry";
import type { ToolContext } from "@/ai/tools/context";

import { extractToolCalls } from "./data-analyst";
import type { AgentResult, StepLike } from "./types";

/** Sourced research findings (§10, §21). */
export const researchFindingsSchema = z.object({
  summary: z.string(),
  findings: z.array(z.string()).describe("Key facts discovered, each grounded in a source"),
  possibleCauses: z.array(z.string()),
  sources: z
    .array(
      z.object({
        title: z.string().describe("Document or data source name"),
        locator: z.string().describe("Section/page/identifier, or an empty string"),
      }),
    )
    .describe("Sources cited for the findings"),
});

export type ResearchFindings = z.infer<typeof researchFindingsSchema>;

export async function runResearch(
  ctx: ToolContext,
  objective: string,
  opts?: {
    maxSteps?: number;
    maxRetries?: number;
    onStep?: (step: StepLike) => void | Promise<void>;
    guard?: GuardrailTracker;
  },
): Promise<AgentResult<ResearchFindings>> {
  const model = await resolveModel(ctx.organizationId);
  const base = buildToolset(ctx, "research");
  const tools = opts?.guard ? opts.guard.wrap(base, "research") : base;
  const maxRetries = opts?.maxRetries ?? 6;

  const gen = await generateText({
    model,
    system: RESEARCH_SYSTEM,
    prompt: objective,
    tools,
    stopWhen: stepCountIs(opts?.maxSteps ?? 6),
    maxRetries,
    onStepFinish: opts?.onStep ? (step) => opts.onStep!(step) : undefined,
  });
  opts?.guard?.throwIfTripped();

  const toolCalls = extractToolCalls(gen.steps);

  const structured = await generateObject({
    model,
    schema: researchFindingsSchema,
    system:
      "Convert the research into structured findings with cited sources. Use ONLY facts and sources already established below. Do not invent sources.",
    prompt: [
      `Objective:\n${objective}`,
      `\nResearch notes:\n${gen.text || "(none)"}`,
      `\nTool results (JSON):\n${JSON.stringify(toolCalls).slice(0, 6000)}`,
      `\nProduce the final structured research findings.`,
    ].join("\n"),
    maxRetries,
  });
  opts?.guard?.throwIfTripped();

  return {
    findings: structured.object,
    toolCalls,
    usage: {
      inputTokens: (gen.totalUsage?.inputTokens ?? 0) + (structured.usage?.inputTokens ?? 0),
      outputTokens: (gen.totalUsage?.outputTokens ?? 0) + (structured.usage?.outputTokens ?? 0),
    },
    text: gen.text,
  };
}
