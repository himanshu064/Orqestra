import "dotenv/config";

import { eq } from "drizzle-orm";

import { DEFAULT_GUARDRAILS, GuardrailError, GuardrailTracker } from "@/ai/guardrails";
import type { AgentEvent } from "@/ai/events";
import { db } from "@/db";
import { agentRuns, agentSteps, organizations, users } from "@/db/schema";
import { RunRecorder } from "@/services/run-recorder";

/**
 * Proves the guardrail path end-to-end against the real persistence layer, without a live LLM:
 * a runaway run is stopped at the step ceiling, fails with a clear reason, and leaves a trace.
 */
async function main() {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, "orqestra-demo"))
    .limit(1);
  if (!org) throw new Error("Demo org not found  run `npm run db:seed`.");
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, "manager@orqestra.demo"))
    .limit(1);
  if (!user) throw new Error("Demo user not found  run `npm run db:seed`.");

  const events: AgentEvent[] = [];
  const recorder = new RunRecorder(org.id, user.id, (e) => events.push(e));
  const guard = new GuardrailTracker({ ...DEFAULT_GUARDRAILS, maxStepsPerRun: 3 });
  recorder.setGuard(guard);
  recorder.setModel("gemini-3.6-flash");

  const runId = await recorder.start("SMOKE: runaway run should hit the step guardrail");
  const stepId = await recorder.agentStarted("manager", "Planning", "plan");

  let breach: GuardrailError | null = null;
  try {
    // Simulate a model that never stops emitting steps.
    for (let i = 0; i < 100; i++) {
      await recorder.recordStep("manager", stepId, { usage: { inputTokens: 50, outputTokens: 10 } });
    }
  } catch (err) {
    if (err instanceof GuardrailError) breach = err;
    else throw err;
  }

  if (!breach) throw new Error("Expected a GuardrailError but none was thrown.");
  await recorder.failed(breach.message, breach.reason);

  const [run] = await db.select().from(agentRuns).where(eq(agentRuns.id, runId));
  const steps = await db.select().from(agentSteps).where(eq(agentSteps.runId, runId));

  const checks = {
    "breach reason is max_steps_per_run": breach.reason === "max_steps_per_run",
    "run persisted as failed": run?.status === "failed",
    "stop_reason recorded": run?.stopReason === "max_steps_per_run",
    "clear error message": Boolean(run?.error && run.error.includes("step limit")),
    "trace persisted (>=1 step)": steps.length >= 1,
    "cost recorded": (run?.estimatedCostCents ?? 0) >= 0 && run?.model === "gemini-3.6-flash",
    "run.failed event emitted": events.some((e) => e.type === "run.failed"),
    "tripped after exactly 4th step": guard.counts.steps === 4,
  };

  console.log("\n── Guardrail checks ──");
  for (const [k, v] of Object.entries(checks)) console.log(`  ${v ? "✓" : "✗"} ${k}`);

  // Clean up the synthetic run.
  await db.delete(agentRuns).where(eq(agentRuns.id, runId));

  const ok = Object.values(checks).every(Boolean);
  console.log(ok ? "\n✅ GUARDRAIL SMOKE PASS" : "\n⚠️  Some checks failed");
  if (!ok) process.exitCode = 1;
}

main().catch((err) => {
  console.error("✗ guardrail smoke failed:", err);
  process.exit(1);
});
