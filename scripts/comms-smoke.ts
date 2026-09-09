import "dotenv/config";

import { eq } from "drizzle-orm";

import { runCommunication } from "@/ai/agents/communication";
import type { AgentEvent } from "@/ai/events";
import type { ToolContext } from "@/ai/tools/context";
import { db } from "@/db";
import { agentRuns, approvals, organizations, users } from "@/db/schema";
import { RunRecorder } from "@/services/run-recorder";

async function main() {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, "orqestra-demo"))
    .limit(1);
  if (!org) throw new Error("Demo org not found.");
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, "manager@orqestra.demo"))
    .limit(1);

  const collected: AgentEvent[] = [];
  const recorder = new RunRecorder(org.id, user!.id, (e) => collected.push(e));
  const runId = await recorder.start("comms smoke");
  const ctx: ToolContext = { organizationId: org.id, userId: user!.id };

  console.log("Running Communication agent (live)…\n");
  try {
    const res = await runCommunication(
      ctx,
      "Draft a short, warm recovery email to customer CUS-1001 about their declining usage, and queue it for approval.",
      recorder,
    );
    console.log("summary:", res.findings.summary);
    console.log("queuedActions:", res.findings.queuedActions);

    const pending = await db.select().from(approvals).where(eq(approvals.runId, runId));
    const approvalEvents = collected.filter((e) => e.type === "approval.required");

    const checks = {
      "queued >= 1 approval (db)": pending.length >= 1,
      "emitted approval.required event": approvalEvents.length >= 1,
      "all queued approvals are pending (not sent)": pending.every((a) => a.status === "pending"),
    };
    console.log("\n── Checks ──");
    for (const [k, v] of Object.entries(checks)) console.log(`  ${v ? "✓" : "✗"} ${k}`);
    const ok = Object.values(checks).every(Boolean);
    console.log(ok ? "\n✅ COMMS SMOKE PASS" : "\n⚠️  Some checks failed");
    if (!ok) process.exitCode = 1;
  } finally {
    // Cleanup: delete the throwaway run (cascade removes its approvals + steps).
    await db.delete(agentRuns).where(eq(agentRuns.id, runId));
  }
}

main().catch((err) => {
  console.error("✗ comms smoke failed:", err);
  process.exit(1);
});
