import "dotenv/config";

import { eq } from "drizzle-orm";

import { managerReportSchema } from "@/ai/agents/manager";
import type { AgentEvent } from "@/ai/events";
import { db } from "@/db";
import { agentRuns, agentSteps, organizations, toolCalls, users } from "@/db/schema";
import { executeAgentRun } from "@/services/agent-runner";

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

  const objective =
    "Analyze our customers and identify high-value accounts at risk of churn; prepare a recovery summary.";

  const collected: AgentEvent[] = [];
  console.log("Running Manager → Data Analyst orchestration (live)…\n");

  const result = await executeAgentRun({
    organizationId: org.id,
    userId: user!.id,
    objective,
    emit: (e) => {
      collected.push(e);
      const detail =
        e.type === "agent.started" || e.type === "agent.completed"
          ? ` ${e.agent}`
          : e.type === "tool.completed"
            ? ` ${e.agent}.${e.tool}`
            : "";
      console.log(`  → ${e.type}${detail}`);
    },
  });

  console.log("\n── Event sequence ──");
  console.log("  " + collected.map((e) => e.type).join(" → "));

  if ("error" in result) {
    console.error("\n✗ Run failed:", result.error);
    process.exit(1);
  }

  managerReportSchema.parse(result.report);
  console.log("\n── Final report ──");
  console.log("  summary:", result.report.summary);
  console.log("  metrics:", result.report.metrics);
  console.log("  agentsInvolved:", result.report.agentsInvolved);

  const [run] = await db.select().from(agentRuns).where(eq(agentRuns.id, result.runId));
  const steps = await db.select().from(agentSteps).where(eq(agentSteps.runId, result.runId));
  const calls = await db.select().from(toolCalls).where(eq(toolCalls.runId, result.runId));

  const checks = {
    "run.started emitted": collected.some((e) => e.type === "run.started"),
    "manager started": collected.some((e) => e.type === "agent.started" && e.agent === "manager"),
    "data_analyst started": collected.some(
      (e) => e.type === "agent.started" && e.agent === "data_analyst",
    ),
    "tool.completed emitted": collected.some((e) => e.type === "tool.completed"),
    "run.completed emitted": collected.some((e) => e.type === "run.completed"),
    "metrics.customersAnalyzed === 2481": result.report.metrics.customersAnalyzed === 2481,
    "run persisted (completed, toolCalls>0)":
      run?.status === "completed" && (run?.totalToolCalls ?? 0) > 0,
    "steps persisted (>=2)": steps.length >= 2,
    "tool_calls persisted (>=1)": calls.length >= 1,
  };

  console.log("\n── Checks ──");
  for (const [k, v] of Object.entries(checks)) console.log(`  ${v ? "✓" : "✗"} ${k}`);

  const ok = Object.values(checks).every(Boolean);
  console.log(ok ? "\n✅ RUN SMOKE PASS" : "\n⚠️  Some checks failed");
  if (!ok) process.exitCode = 1;
}

main().catch((err) => {
  console.error("✗ run smoke failed:", err);
  process.exit(1);
});
