import { eq } from "drizzle-orm";

import { events, type AgentEvent } from "@/ai/events";
import type { GuardrailTracker } from "@/ai/guardrails";
import type { StepLike } from "@/ai/agents/types";
import type { AgentKey } from "@/ai/tools/registry";
import { db } from "@/db";
import { agentMessages, agentRuns, agentSteps, stepType, toolCalls } from "@/db/schema";
import { estimateCostCents } from "@/lib/cost";

type StepKind = (typeof stepType.enumValues)[number];

/**
 * Single sink for an agent run: persists agent_runs / agent_steps / tool_calls / agent_messages
 * AND emits the standardized event stream (§23, §34). Both the Manager's and Data Analyst's
 * `onStepFinish` route their finished steps here via `recordStep`.
 */
export class RunRecorder {
  private runId = "";
  private stepIndex = 0;
  private totals = { steps: 0, toolCalls: 0, inputTokens: 0, outputTokens: 0 };
  private model: string | null = null;
  private guard: GuardrailTracker | null = null;

  constructor(
    private readonly organizationId: string,
    private readonly userId: string,
    private readonly emit: (event: AgentEvent) => void,
  ) {}

  get id(): string {
    return this.runId;
  }

  /** Record which model powered the run (for cost + display, §40). */
  setModel(modelId: string | null | undefined): void {
    this.model = modelId ?? null;
  }

  /** Attach a guardrail tracker so per-step + budget ceilings are enforced (§35). */
  setGuard(guard: GuardrailTracker): void {
    this.guard = guard;
  }

  /** Emit a raw event to the stream (used by sub-agents e.g. approval.required). */
  emitEvent(event: AgentEvent): void {
    this.emit(event);
  }

  async start(objective: string): Promise<string> {
    const [row] = await db
      .insert(agentRuns)
      .values({
        organizationId: this.organizationId,
        userId: this.userId,
        objective,
        status: "running",
        startedAt: new Date(),
      })
      .returning({ id: agentRuns.id });
    this.runId = row!.id;

    await db.insert(agentMessages).values({
      runId: this.runId,
      organizationId: this.organizationId,
      role: "user",
      content: { text: objective },
    });

    this.emit(events.runStarted(this.runId, objective));
    return this.runId;
  }

  /**
   * Open a step for an agent invocation and return its id. The id must be threaded back to
   * `agentCompleted`/`agentFailed`/`recordStep` - steps are NOT tracked by agent key, so two
   * concurrent delegations to the SAME agent each get their own step with no cross-talk.
   */
  async agentStarted(agent: AgentKey, title?: string, kind: StepKind = "delegate"): Promise<string> {
    const [row] = await db
      .insert(agentSteps)
      .values({
        runId: this.runId,
        organizationId: this.organizationId,
        agent,
        stepIndex: this.stepIndex++,
        type: kind,
        title,
        status: "running",
        startedAt: new Date(),
      })
      .returning({ id: agentSteps.id });
    this.totals.steps++;
    this.emit(events.agentStarted(this.runId, agent, title));
    return row!.id;
  }

  async agentCompleted(
    agent: AgentKey,
    stepId: string,
    summary?: string,
    output?: unknown,
  ): Promise<void> {
    await db
      .update(agentSteps)
      .set({
        status: "success",
        completedAt: new Date(),
        output: output ?? (summary ? { summary } : null),
      })
      .where(eq(agentSteps.id, stepId));
    this.emit(events.agentCompleted(this.runId, agent, summary));
  }

  async agentFailed(agent: AgentKey, stepId: string, error: string): Promise<void> {
    await db
      .update(agentSteps)
      .set({ status: "error", error, completedAt: new Date() })
      .where(eq(agentSteps.id, stepId));
    this.emit(events.agentFailed(this.runId, agent, error));
  }

  addUsage(inputTokens?: number, outputTokens?: number): void {
    this.totals.inputTokens += inputTokens ?? 0;
    this.totals.outputTokens += outputTokens ?? 0;
    // Accrue estimated cost for the optional per-run budget guardrail (§35).
    this.guard?.addCost(this.model, inputTokens ?? 0, outputTokens ?? 0);
  }

  /**
   * Persist + emit the tool calls in a finished step. `stepId` is the id returned by
   * `agentStarted` for THIS invocation (delegation tools are surfaced as agent lifecycle, not
   * tool_calls). Passing it explicitly keeps concurrent same-agent steps from cross-attributing.
   */
  async recordStep(agent: AgentKey, stepId: string, step: StepLike): Promise<void> {
    // One LLM step finished - enforce the per-run step ceiling (§35).
    // NOTE: usage is intentionally NOT accrued here. Each agent's usage is added exactly once via
    // addUsage() at the call site (manager phase-1 total, manager structured, and each specialist's
    // res.usage), so accruing per-step here too would double-count generateText tokens.
    this.guard?.recordStep();
    const outputByCall = new Map<string, unknown>();
    for (const r of step.toolResults ?? []) outputByCall.set(r.toolCallId, r.output);

    // Collect this step's tool calls and persist them in ONE multi-row insert instead of N
    // sequential Neon-HTTP round-trips.
    const rows: (typeof toolCalls.$inferInsert)[] = [];
    const emits: { tool: string; status: "success" | "error"; output: unknown }[] = [];
    for (const c of step.toolCalls ?? []) {
      if (c.toolName.startsWith("delegate")) continue;
      const output = outputByCall.get(c.toolCallId);
      // A gracefully-degraded tool returns `{ error: true, … }` (guardrails.wrap) - record it as an
      // error, not a success, so tool_calls.status reflects reality for analytics.
      const degraded =
        !!output && typeof output === "object" && (output as { error?: unknown }).error === true;
      const status: "success" | "error" =
        outputByCall.has(c.toolCallId) && !degraded ? "success" : "error";
      rows.push({
        runId: this.runId,
        stepId,
        organizationId: this.organizationId,
        agent,
        tool: c.toolName,
        input: c.input,
        output,
        status,
        durationMs: 0,
      });
      emits.push({ tool: c.toolName, status, output });
    }

    if (rows.length === 0) return;
    await db.insert(toolCalls).values(rows);
    this.totals.toolCalls += rows.length;
    for (const e of emits) {
      this.emit(events.toolCompleted(this.runId, agent, e.tool, e.status, 0, e.output));
    }
  }

  async completed(result: unknown, summary?: string): Promise<void> {
    if (summary) {
      await db.insert(agentMessages).values({
        runId: this.runId,
        organizationId: this.organizationId,
        role: "assistant",
        agent: "manager",
        content: { summary },
      });
    }
    await db
      .update(agentRuns)
      .set({
        status: "completed",
        stopReason: "completed",
        model: this.model,
        completedAt: new Date(),
        totalSteps: this.totals.steps,
        totalToolCalls: this.totals.toolCalls,
        inputTokens: this.totals.inputTokens,
        outputTokens: this.totals.outputTokens,
        estimatedCostCents: estimateCostCents(
          this.model,
          this.totals.inputTokens,
          this.totals.outputTokens,
        ),
        finalResult: result,
      })
      .where(eq(agentRuns.id, this.runId));
    this.emit(
      events.runCompleted(this.runId, result, {
        steps: this.totals.steps,
        toolCalls: this.totals.toolCalls,
      }),
    );
  }

  async failed(error: string, stopReason = "error"): Promise<void> {
    if (this.runId) {
      await db
        .update(agentRuns)
        .set({
          status: "failed",
          stopReason,
          model: this.model,
          error,
          completedAt: new Date(),
          totalSteps: this.totals.steps,
          totalToolCalls: this.totals.toolCalls,
          inputTokens: this.totals.inputTokens,
          outputTokens: this.totals.outputTokens,
          estimatedCostCents: estimateCostCents(
            this.model,
            this.totals.inputTokens,
            this.totals.outputTokens,
          ),
        })
        .where(eq(agentRuns.id, this.runId));
    }
    this.emit(events.runFailed(this.runId, error));
  }
}
