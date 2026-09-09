import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import type { AgentEvent } from "@/ai/events";
import { db } from "@/db";
import { agentRuns, agentSteps, organizations, toolCalls, users } from "@/db/schema";
import { RunRecorder } from "@/services/run-recorder";

let orgId: string;
let userId: string;
let runId = "";
const emitted: AgentEvent[] = [];

beforeAll(async () => {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, "orqestra-demo"))
    .limit(1);
  if (!org) throw new Error("Demo org not found  run `npm run db:seed`.");
  orgId = org.id;
  const [u] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, "manager@orqestra.demo"))
    .limit(1);
  userId = u!.id;
});

afterAll(async () => {
  // Cascade removes steps / tool_calls / messages.
  if (runId) await db.delete(agentRuns).where(eq(agentRuns.id, runId));
});

describe("RunRecorder", () => {
  test("persists run/steps/tool_calls and emits the event sequence", async () => {
    const rec = new RunRecorder(orgId, userId, (e) => emitted.push(e));
    runId = await rec.start("test objective");

    const managerStep = await rec.agentStarted("manager", "Planning", "plan");
    const daStep = await rec.agentStarted("data_analyst", "Analyze", "delegate");
    await rec.recordStep("data_analyst", daStep, {
      toolCalls: [{ toolName: "getCustomerMetrics", toolCallId: "t1", input: {} }],
      toolResults: [{ toolCallId: "t1", output: { customersAnalyzed: 2481 } }],
      usage: { inputTokens: 100, outputTokens: 20 },
    });
    // Usage is accrued once at the call site (recordStep no longer accrues it  see A1 fix).
    rec.addUsage(100, 20);
    await rec.agentCompleted("data_analyst", daStep, "done");
    await rec.agentCompleted("manager", managerStep, "final");
    await rec.completed({ summary: "ok" }, "ok");

    // Emitted event sequence
    expect(emitted.map((e) => e.type)).toEqual([
      "run.started",
      "agent.started",
      "agent.started",
      "tool.completed",
      "agent.completed",
      "agent.completed",
      "run.completed",
    ]);

    // Persisted rows
    const [run] = await db.select().from(agentRuns).where(eq(agentRuns.id, runId));
    expect(run!.status).toBe("completed");
    expect(run!.totalToolCalls).toBe(1);
    expect(run!.totalSteps).toBe(2);
    expect(run!.inputTokens).toBe(100);

    const steps = await db.select().from(agentSteps).where(eq(agentSteps.runId, runId));
    expect(steps.length).toBe(2);
    expect(steps.every((s) => s.status === "success")).toBe(true);

    const calls = await db.select().from(toolCalls).where(eq(toolCalls.runId, runId));
    expect(calls.length).toBe(1);
    expect(calls[0]!.tool).toBe("getCustomerMetrics");
  });
});
