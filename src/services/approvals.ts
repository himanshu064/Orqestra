import { randomUUID } from "node:crypto";

import { and, desc, eq } from "drizzle-orm";

import type { AgentKey } from "@/ai/tools/registry";
import { sendEmailPayload } from "@/config/actions";
import { db } from "@/db";
import { agentRuns, approvals, approvalStatus, auditLogs } from "@/db/schema";
import { sendEmail } from "@/services/email";

type ApprovalStatus = (typeof approvalStatus.enumValues)[number];

// --- audit (append-only, §38) -------------------------------------------------
async function writeAudit(
  orgId: string,
  entry: {
    actorType: "user" | "agent" | "system";
    actorId: string | null;
    action: string;
    targetType: string;
    targetId: string;
    metadata?: unknown;
    result: string;
  },
): Promise<void> {
  await db.insert(auditLogs).values({
    organizationId: orgId,
    actorType: entry.actorType,
    actorId: entry.actorId,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    metadata: entry.metadata ?? null,
    result: entry.result,
  });
}

// --- action execution (§26) ---------------------------------------------------
// send_email is real when EMAIL_API_KEY (Resend) is configured; other actions stay mocked.
async function executeAction(
  actionType: string,
  payload: unknown,
): Promise<{ ok: boolean; result: unknown; summary: string }> {
  const p = (payload ?? {}) as Record<string, unknown>;
  if (actionType === "send_email") {
    const email = sendEmailPayload.parse(payload);
    const to = email.to;
    const res = await sendEmail(email);
    if (res.ok) {
      return {
        ok: true,
        result: {
          sent: true,
          to,
          subject: email.subject,
          provider: res.provider,
          messageId: res.id,
          at: new Date().toISOString(),
        },
        summary:
          res.provider === "resend" ? `Email sent to ${to}` : `Email to ${to} recorded (no email provider configured)`,
      };
    }
    return {
      ok: false,
      result: { sent: false, to, provider: res.provider, error: res.error },
      summary: `Email to ${to} failed: ${res.error}`,
    };
  }
  if (actionType === "create_crm_task") {
    return {
      ok: true,
      result: { created: true, ref: `CRM-${Date.now().toString().slice(-6)}` },
      summary: `CRM task created: ${String(p.title ?? "task")}`,
    };
  }
  return { ok: true, result: { executed: true }, summary: `Executed ${actionType}` };
}

// --- engine -------------------------------------------------------------------
export type RequestApprovalInput = {
  runId: string;
  stepId?: string | null;
  actionType: string;
  payload: unknown;
  requestedByAgent: AgentKey;
};

export async function requestApproval(orgId: string, input: RequestApprovalInput) {
  const [row] = await db
    .insert(approvals)
    .values({
      organizationId: orgId,
      runId: input.runId,
      stepId: input.stepId ?? null,
      actionType: input.actionType,
      payload: input.payload,
      requestedByAgent: input.requestedByAgent,
      status: "pending",
      idempotencyKey: randomUUID(),
    })
    .returning();
  return row!;
}

export async function listApprovals(orgId: string, status?: ApprovalStatus) {
  const where = status
    ? and(eq(approvals.organizationId, orgId), eq(approvals.status, status))
    : eq(approvals.organizationId, orgId);

  return db
    .select({
      id: approvals.id,
      runId: approvals.runId,
      actionType: approvals.actionType,
      payload: approvals.payload,
      status: approvals.status,
      requestedByAgent: approvals.requestedByAgent,
      requestedAt: approvals.createdAt,
      decidedAt: approvals.decidedAt,
      executedAt: approvals.executedAt,
      executionResult: approvals.executionResult,
      runObjective: agentRuns.objective,
    })
    .from(approvals)
    .leftJoin(agentRuns, eq(approvals.runId, agentRuns.id))
    .where(where)
    .orderBy(desc(approvals.createdAt));
}

export type ApproveResult =
  { ok: true; alreadyExecuted?: boolean; summary?: string } | { ok: false; reason: string };

/** Server-verified, at-most-once approval + execution (§37). */
export async function approveApproval(
  orgId: string,
  userId: string,
  id: string,
): Promise<ApproveResult> {
  // Atomic claim: only a pending row moves to `executing`; exactly one caller wins (at-most-once).
  // We claim to an intermediate state BEFORE running the side-effect, so a crash mid-send leaves a
  // recoverable `executing` row rather than a false `executed` with no result.
  const claimed = await db
    .update(approvals)
    .set({ status: "executing", decidedByUserId: userId, decidedAt: new Date() })
    .where(
      and(
        eq(approvals.id, id),
        eq(approvals.organizationId, orgId),
        eq(approvals.status, "pending"),
      ),
    )
    .returning();

  if (claimed.length === 0) {
    const [existing] = await db
      .select()
      .from(approvals)
      .where(and(eq(approvals.id, id), eq(approvals.organizationId, orgId)))
      .limit(1);
    if (!existing) return { ok: false, reason: "not_found" };
    if (existing.status === "executed") return { ok: true, alreadyExecuted: true };
    if (existing.status === "executing") return { ok: false, reason: "in_progress" };
    return { ok: false, reason: `cannot approve (status: ${existing.status})` };
  }

  const approval = claimed[0]!;
  const { ok, result, summary } = await executeAction(approval.actionType, approval.payload);
  // Settle the intermediate state: executed (+ executedAt) on success, failed otherwise.
  await db
    .update(approvals)
    .set({
      status: ok ? "executed" : "failed",
      executedAt: ok ? new Date() : null,
      executionResult: result,
    })
    .where(and(eq(approvals.id, id), eq(approvals.organizationId, orgId)));

  await writeAudit(orgId, {
    actorType: "user",
    actorId: userId,
    action: "approval.executed",
    targetType: "approval",
    targetId: id,
    metadata: { actionType: approval.actionType, summary },
    result: ok ? "success" : "failed",
  });

  return ok ? { ok: true, summary } : { ok: false, reason: summary };
}

export async function rejectApproval(
  orgId: string,
  userId: string,
  id: string,
  reason?: string,
): Promise<ApproveResult> {
  const rejected = await db
    .update(approvals)
    .set({
      status: "rejected",
      decidedByUserId: userId,
      decidedAt: new Date(),
      executionResult: reason ? { reason } : null,
    })
    .where(
      and(
        eq(approvals.id, id),
        eq(approvals.organizationId, orgId),
        eq(approvals.status, "pending"),
      ),
    )
    .returning();

  if (rejected.length === 0) {
    const [existing] = await db
      .select()
      .from(approvals)
      .where(and(eq(approvals.id, id), eq(approvals.organizationId, orgId)))
      .limit(1);
    if (!existing) return { ok: false, reason: "not_found" };
    return { ok: false, reason: `cannot reject (status: ${existing.status})` };
  }

  await writeAudit(orgId, {
    actorType: "user",
    actorId: userId,
    action: "approval.rejected",
    targetType: "approval",
    targetId: id,
    metadata: { reason: reason ?? null },
    result: "rejected",
  });

  return { ok: true };
}
