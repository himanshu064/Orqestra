import { and, count, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { db } from "@/db";
import { agentRuns, approvals, auditLogs, organizations, users } from "@/db/schema";
import { approveApproval, rejectApproval, requestApproval } from "@/services/approvals";

const FOREIGN = "00000000-0000-0000-0000-000000000000";

let orgId: string;
let userId: string;
let runId = "";
const createdApprovalIds: string[] = [];

async function auditCount(approvalId: string): Promise<number> {
  const [{ n }] = await db
    .select({ n: count() })
    .from(auditLogs)
    .where(eq(auditLogs.targetId, approvalId));
  return n;
}

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

  const [run] = await db
    .insert(agentRuns)
    .values({ organizationId: orgId, userId, objective: "approval test run", status: "running" })
    .returning({ id: agentRuns.id });
  runId = run!.id;
});

afterAll(async () => {
  if (createdApprovalIds.length) {
    await db.delete(auditLogs).where(inArray(auditLogs.targetId, createdApprovalIds));
  }
  if (runId) await db.delete(agentRuns).where(eq(agentRuns.id, runId)); // cascade removes approvals
});

describe("approval engine", () => {
  test("approve executes exactly once (idempotent) + audits", async () => {
    const a = await requestApproval(orgId, {
      runId,
      actionType: "send_email",
      payload: { to: "customer@example.com", subject: "We miss you", body: "Come back!" },
      requestedByAgent: "communication",
    });
    createdApprovalIds.push(a.id);
    expect(a.status).toBe("pending");

    const first = await approveApproval(orgId, userId, a.id);
    expect(first).toMatchObject({ ok: true });
    expect("alreadyExecuted" in first && first.alreadyExecuted).toBeFalsy();

    const [row1] = await db.select().from(approvals).where(eq(approvals.id, a.id));
    expect(row1!.status).toBe("executed");
    expect(row1!.executedAt).not.toBeNull();
    expect(row1!.executionResult).toMatchObject({ sent: true });
    expect(await auditCount(a.id)).toBe(1);

    // Second approve is a no-op  still exactly one execution + one audit row.
    const second = await approveApproval(orgId, userId, a.id);
    expect(second).toMatchObject({ ok: true, alreadyExecuted: true });
    expect(await auditCount(a.id)).toBe(1);
  });

  test("reject blocks later approval + audits", async () => {
    const a = await requestApproval(orgId, {
      runId,
      actionType: "create_crm_task",
      payload: { title: "Follow up" },
      requestedByAgent: "communication",
    });
    createdApprovalIds.push(a.id);

    const rej = await rejectApproval(orgId, userId, a.id, "not needed");
    expect(rej).toMatchObject({ ok: true });

    const [row] = await db.select().from(approvals).where(eq(approvals.id, a.id));
    expect(row!.status).toBe("rejected");

    const approveAfter = await approveApproval(orgId, userId, a.id);
    expect(approveAfter.ok).toBe(false);
    expect(await auditCount(a.id)).toBe(1); // only the reject audit
  });

  test("foreign org cannot approve (scoping)", async () => {
    const a = await requestApproval(orgId, {
      runId,
      actionType: "send_email",
      payload: { to: "x@example.com" },
      requestedByAgent: "communication",
    });
    createdApprovalIds.push(a.id);

    const res = await approveApproval(FOREIGN, userId, a.id);
    expect(res).toMatchObject({ ok: false, reason: "not_found" });

    const [row] = await db
      .select()
      .from(approvals)
      .where(and(eq(approvals.id, a.id), eq(approvals.organizationId, orgId)));
    expect(row!.status).toBe("pending"); // untouched
  });
});
