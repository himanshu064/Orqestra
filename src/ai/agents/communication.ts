import { generateObject, generateText, stepCountIs } from "ai";
import { z } from "zod";

import type { GuardrailTracker } from "@/ai/guardrails";
import { resolveModel } from "@/ai/provider";
import { COMMUNICATION_SYSTEM } from "@/ai/prompts/communication";
import { createCommunicationTools } from "@/ai/tools/communication-tools";
import type { ToolContext } from "@/ai/tools/context";
import type { RunRecorder } from "@/services/run-recorder";

import { extractToolCalls } from "./data-analyst";
import type { AgentResult, StepLike } from "./types";

export const communicationResultSchema = z.object({
  summary: z.string(),
  drafts: z.array(z.object({ to: z.string(), subject: z.string(), body: z.string() })),
  queuedActions: z.array(
    z.object({ actionType: z.string(), approvalId: z.string(), summary: z.string() }),
  ),
});

export type CommunicationResult = z.infer<typeof communicationResultSchema>;

export async function runCommunication(
  ctx: ToolContext,
  objective: string,
  recorder: RunRecorder,
  opts?: {
    maxSteps?: number;
    maxRetries?: number;
    onStep?: (step: StepLike) => void | Promise<void>;
    guard?: GuardrailTracker;
  },
): Promise<AgentResult<CommunicationResult>> {
  const model = await resolveModel(ctx.organizationId);
  const maxRetries = opts?.maxRetries ?? 6;

  const base = createCommunicationTools(ctx, {
    runId: recorder.id,
    emit: (e) => recorder.emitEvent(e),
  });
  const tools = opts?.guard ? opts.guard.wrap(base, "communication") : base;

  const gen = await generateText({
    model,
    system: COMMUNICATION_SYSTEM,
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
    schema: communicationResultSchema,
    system:
      "Summarize what the Communication Agent drafted and queued for approval. Use ONLY the drafts and approvals already created below (from the tool results). queuedActions must reference real approvalIds returned by the tools; if none were queued, use an empty array.",
    prompt: [
      `Objective:\n${objective}`,
      `\nAgent notes:\n${gen.text || "(none)"}`,
      `\nTool results (JSON):\n${JSON.stringify(toolCalls).slice(0, 6000)}`,
      `\nProduce the final communication result.`,
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
