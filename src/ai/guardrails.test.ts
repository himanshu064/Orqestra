import type { ToolSet } from "ai";
import { describe, expect, test } from "vitest";

import { GuardrailError, GuardrailTracker, DEFAULT_GUARDRAILS } from "@/ai/guardrails";

function cfg(overrides: Partial<typeof DEFAULT_GUARDRAILS> = {}) {
  return { ...DEFAULT_GUARDRAILS, ...overrides };
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Minimal tool with a controllable execute. */
function toolset(execute: (input: unknown) => Promise<unknown>): ToolSet {
  return { probe: { description: "", inputSchema: undefined, execute } } as unknown as ToolSet;
}

describe("GuardrailTracker ceilings", () => {
  test("step ceiling trips with reason", () => {
    const g = new GuardrailTracker(cfg({ maxStepsPerRun: 3 }));
    g.recordStep();
    g.recordStep();
    g.recordStep();
    expect(() => g.recordStep()).toThrow(GuardrailError);
    expect(g.breached?.reason).toBe("max_steps_per_run");
  });

  test("agent-hop ceiling trips with reason", () => {
    const g = new GuardrailTracker(cfg({ maxAgentHops: 2 }));
    g.recordHop();
    g.recordHop();
    try {
      g.recordHop();
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(GuardrailError);
      expect((e as GuardrailError).reason).toBe("max_agent_hops");
    }
  });

  test("budget ceiling trips when a per-run budget is set", () => {
    const g = new GuardrailTracker(cfg({ perRunBudgetCents: 5 }));
    // gemini-3.6-flash: 1M in @ $0.30, 1M out @ $2.50 → well over 5 cents.
    expect(() => g.addCost("gemini-3.6-flash", 1_000_000, 1_000_000)).toThrow(GuardrailError);
    expect(g.breached?.reason).toBe("budget_exceeded");
  });

  test("no budget → addCost never trips", () => {
    const g = new GuardrailTracker(cfg({ perRunBudgetCents: null }));
    g.addCost("claude-opus-4-8", 5_000_000, 5_000_000);
    expect(g.breached).toBeNull();
    expect(g.counts.costCents).toBeGreaterThan(0);
  });

  test("throwIfTripped re-throws the latched breach", () => {
    const g = new GuardrailTracker(cfg({ maxStepsPerRun: 1 }));
    g.recordStep();
    expect(() => g.recordStep()).toThrow();
    expect(() => g.throwIfTripped()).toThrow(GuardrailError);
  });
});

describe("GuardrailTracker.wrap", () => {
  test("per-agent tool-call cap trips (terminal)", async () => {
    const g = new GuardrailTracker(cfg({ maxToolCallsPerAgent: 2 }));
    const tools = g.wrap(
      toolset(async () => ({ ok: true })),
      "data_analyst",
    );
    const exec = tools.probe!.execute as (i: unknown, o: unknown) => Promise<unknown>;
    await exec({}, {});
    await exec({}, {});
    await expect(exec({}, {})).rejects.toBeInstanceOf(GuardrailError);
    expect(g.breached?.reason).toBe("max_tool_calls_per_agent");
  });

  test("tool timeout is terminal", async () => {
    const g = new GuardrailTracker(cfg({ perToolTimeoutMs: 20 }));
    const tools = g.wrap(
      toolset(async () => {
        await delay(200);
        return { late: true };
      }),
      "research",
    );
    const exec = tools.probe!.execute as (i: unknown, o: unknown) => Promise<unknown>;
    await expect(exec({}, {})).rejects.toBeInstanceOf(GuardrailError);
    expect(g.breached?.reason).toBe("tool_timeout");
  });

  test("ordinary tool error degrades gracefully (run continues)", async () => {
    const g = new GuardrailTracker(cfg());
    const tools = g.wrap(
      toolset(async () => {
        throw new Error("db unavailable");
      }),
      "data_analyst",
    );
    const exec = tools.probe!.execute as (i: unknown, o: unknown) => Promise<unknown>;
    const result = (await exec({}, {})) as { error: boolean; message: string };
    expect(result.error).toBe(true);
    expect(result.message).toContain("db unavailable");
    expect(g.breached).toBeNull(); // NOT terminal
  });

  test("captures real duration and success outcome", async () => {
    const g = new GuardrailTracker(cfg());
    const outcomes: { tool: string; status: string; durationMs: number }[] = [];
    const tools = g.wrap(
      toolset(async () => {
        await delay(15);
        return { ok: true };
      }),
      "data_analyst",
      (o) => {
        outcomes.push({ tool: o.tool, status: o.status, durationMs: o.durationMs });
      },
    );
    const exec = tools.probe!.execute as (i: unknown, o: unknown) => Promise<unknown>;
    await exec({}, {});
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]!.status).toBe("success");
    expect(outcomes[0]!.durationMs).toBeGreaterThanOrEqual(10);
  });
});
