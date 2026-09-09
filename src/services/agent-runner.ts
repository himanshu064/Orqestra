import { runManager, type ManagerReport } from "@/ai/agents/manager";
import type { AgentEvent } from "@/ai/events";
import { DEFAULT_GUARDRAILS, GuardrailError, GuardrailTracker, type GuardrailConfig } from "@/ai/guardrails";
import { resolveModelId } from "@/ai/provider";
import type { ToolContext } from "@/ai/tools/context";
import { toClientError } from "@/lib/errors";
import { RunRecorder } from "@/services/run-recorder";

export type ExecuteAgentRunArgs = {
  organizationId: string;
  userId: string;
  objective: string;
  emit: (event: AgentEvent) => void;
  /** Override runtime guardrails (§35). Defaults to DEFAULT_GUARDRAILS. */
  guardrails?: Partial<GuardrailConfig>;
};

export type ExecuteAgentRunResult =
  { runId: string; report: ManagerReport } | { runId: string; error: string };

/**
 * Top-level orchestration entry: create a run, run the Manager (which delegates to specialists),
 * persist the trace, and stream events via `emit`. Returns the final report or an error.
 */
export async function executeAgentRun(args: ExecuteAgentRunArgs): Promise<ExecuteAgentRunResult> {
  const recorder = new RunRecorder(args.organizationId, args.userId, args.emit);
  const guard = new GuardrailTracker({ ...DEFAULT_GUARDRAILS, ...args.guardrails });
  recorder.setGuard(guard);
  const ctx: ToolContext = { organizationId: args.organizationId, userId: args.userId };

  try {
    await recorder.start(args.objective);
    recorder.setModel(await resolveModelId(args.organizationId));
    const report = await runManager(ctx, args.objective, recorder, { guard });
    await recorder.completed(report, report.summary);
    return { runId: recorder.id, report };
  } catch (err) {
    // A guardrail breach may be latched on the tracker even if the SDK wrapped/swallowed the throw.
    const breach = err instanceof GuardrailError ? err : guard.breached;
    // Log the raw error server-side; surface only a safe message to the client (no DB/provider internals).
    console.error("[agent-run] failed", err);
    const msg = breach ? breach.message : toClientError(err);
    await recorder.failed(msg, breach ? breach.reason : "error");
    return { runId: recorder.id, error: msg };
  }
}
