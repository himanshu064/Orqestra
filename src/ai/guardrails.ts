import type { Tool, ToolSet } from "ai";

import { estimateCostCents } from "@/lib/cost";

/**
 * Runtime guardrails (§35, Appendix A.5). Hard, configurable ceilings enforced by our
 * orchestration code  NOT by the LLM  so a runaway run is stopped with a clear reason and a
 * persisted trace. Ordinary tool failures degrade gracefully (a structured error the model can
 * read); only ceiling breaches and per-tool timeouts are terminal.
 */

export type GuardrailConfig = {
  maxStepsPerRun: number;
  maxToolCallsPerAgent: number;
  maxAgentHops: number;
  perToolTimeoutMs: number;
  /** Optional soft budget that aborts the run when exceeded (null = disabled). */
  perRunBudgetCents: number | null;
};

export const DEFAULT_GUARDRAILS: GuardrailConfig = {
  maxStepsPerRun: 25,
  maxToolCallsPerAgent: 15,
  maxAgentHops: 8,
  perToolTimeoutMs: 30_000,
  // Runaway-cost ceiling: abort a single run that exceeds $1.00 of estimated spend.
  perRunBudgetCents: 100,
};

export type GuardrailReason =
  | "max_steps_per_run"
  | "max_tool_calls_per_agent"
  | "max_agent_hops"
  | "tool_timeout"
  | "budget_exceeded";

export class GuardrailError extends Error {
  constructor(
    readonly reason: GuardrailReason,
    message: string,
  ) {
    super(message);
    this.name = "GuardrailError";
  }
}

function timeout<T>(promise: PromiseLike<T>, ms: number, onTimeout: () => Error): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(onTimeout()), ms);
    Promise.resolve(promise).then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/** Reported to the caller when a wrapped tool finishes (for real-duration persistence). */
export type ToolOutcome = {
  agent: string;
  tool: string;
  input: unknown;
  output: unknown;
  status: "success" | "error";
  durationMs: number;
};

export class GuardrailTracker {
  private stepCount = 0;
  private hopCount = 0;
  private toolCallsByAgent = new Map<string, number>();
  private costCents = 0;
  /** First breach, latched so it can be re-thrown even if the SDK swallows a tool error. */
  private tripped: GuardrailError | null = null;

  constructor(readonly config: GuardrailConfig = DEFAULT_GUARDRAILS) {}

  private trip(reason: GuardrailReason, message: string): never {
    const err = new GuardrailError(reason, message);
    this.tripped ??= err;
    throw err;
  }

  /** Re-throw the first breach, if any. Call after each generateText/Object returns. */
  throwIfTripped(): void {
    if (this.tripped) throw this.tripped;
  }

  get breached(): GuardrailError | null {
    return this.tripped;
  }

  get counts() {
    return { steps: this.stepCount, hops: this.hopCount, costCents: this.costCents };
  }

  /** One LLM step finished (called from the recorder's per-step hook). */
  recordStep(): void {
    if (++this.stepCount > this.config.maxStepsPerRun) {
      this.trip("max_steps_per_run", `Run exceeded the step limit (${this.config.maxStepsPerRun}).`);
    }
  }

  /** Manager delegated to a specialist. */
  recordHop(): void {
    if (++this.hopCount > this.config.maxAgentHops) {
      this.trip(
        "max_agent_hops",
        `Run exceeded the agent-delegation limit (${this.config.maxAgentHops}).`,
      );
    }
  }

  /** Accrue estimated cost; aborts if a per-run budget is set and exceeded. */
  addCost(model: string | null, inputTokens: number, outputTokens: number): void {
    this.costCents += estimateCostCents(model, inputTokens, outputTokens);
    if (this.config.perRunBudgetCents != null && this.costCents > this.config.perRunBudgetCents) {
      this.trip(
        "budget_exceeded",
        `Run exceeded its budget ($${(this.config.perRunBudgetCents / 100).toFixed(2)}).`,
      );
    }
  }

  private countToolCall(agent: string): void {
    const n = (this.toolCallsByAgent.get(agent) ?? 0) + 1;
    this.toolCallsByAgent.set(agent, n);
    if (n > this.config.maxToolCallsPerAgent) {
      this.trip(
        "max_tool_calls_per_agent",
        `${agent} exceeded its tool-call limit (${this.config.maxToolCallsPerAgent}).`,
      );
    }
  }

  /**
   * Wrap a specialist's toolset so every call is counted (per-agent cap), timed (real duration),
   * timeout-guarded, and reported. Ceiling/timeout breaches throw (terminal); other tool exceptions
   * return a structured error so one failed tool doesn't kill the run.
   */
  wrap(tools: ToolSet, agent: string, onOutcome?: (o: ToolOutcome) => void | Promise<void>): ToolSet {
    const wrapped: ToolSet = {};
    for (const [name, t] of Object.entries(tools)) {
      const original = t.execute;
      if (!original) {
        wrapped[name] = t;
        continue;
      }
      wrapped[name] = {
        ...t,
        execute: async (input: unknown, options: unknown) => {
          this.countToolCall(agent); // terminal if over the cap
          const start = Date.now();
          try {
            const output = await timeout(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (original as any)(input, options),
              this.config.perToolTimeoutMs,
              () =>
                new GuardrailError(
                  "tool_timeout",
                  `Tool "${name}" timed out after ${this.config.perToolTimeoutMs}ms.`,
                ),
            );
            await onOutcome?.({ agent, tool: name, input, output, status: "success", durationMs: Date.now() - start });
            return output;
          } catch (err) {
            const durationMs = Date.now() - start;
            if (err instanceof GuardrailError) {
              this.tripped ??= err;
              await onOutcome?.({ agent, tool: name, input, output: { error: err.message }, status: "error", durationMs });
              throw err; // terminal
            }
            // Graceful degradation: hand the model a structured error instead of aborting.
            const message = err instanceof Error ? err.message : String(err);
            await onOutcome?.({ agent, tool: name, input, output: { error: message }, status: "error", durationMs });
            return { error: true, message };
          }
        },
      } as Tool;
    }
    return wrapped;
  }
}
