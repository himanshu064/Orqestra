import { and, eq } from "drizzle-orm";
import { tool } from "ai";
import { z } from "zod";

import { events, type AgentEvent } from "@/ai/events";
import { createCrmTaskPayload, sendEmailPayload, summarizeAction } from "@/config/actions";
import { db } from "@/db";
import { customers, notifications } from "@/db/schema";
import { requestApproval } from "@/services/approvals";

import type { ToolContext } from "./context";

/** Run-scoped context the sensitive communication tools need to queue approvals + stream events. */
export type ApprovalToolContext = {
  runId: string;
  emit?: (event: AgentEvent) => void;
};

async function findCustomer(ctx: ToolContext, customerId?: string, externalRef?: string) {
  const ident = customerId
    ? eq(customers.id, customerId)
    : externalRef
      ? eq(customers.externalRef, externalRef)
      : null;
  if (!ident) return null;
  const [c] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.organizationId, ctx.organizationId), ident))
    .limit(1);
  return c ?? null;
}

/** One-line approval summary for the event stream, from the shared action registry. */
function summaryLine(actionType: string, payload: unknown): string {
  const { title, detail } = summarizeAction(actionType, payload);
  return detail ? `${title} - "${detail}"` : title;
}

export function createCommunicationTools(ctx: ToolContext, approvalCtx: ApprovalToolContext) {
  return {
    getCustomerContact: tool({
      description:
        "Look up a customer's contact details (name, email, company) by id or external ref.",
      inputSchema: z.object({
        customerId: z.string().optional(),
        externalRef: z.string().optional().describe("e.g. CUS-1042"),
      }),
      execute: async ({ customerId, externalRef }) => {
        const c = await findCustomer(ctx, customerId, externalRef);
        if (!c) return { found: false as const };
        return {
          found: true as const,
          externalRef: c.externalRef,
          name: c.name,
          email: c.email,
          company: c.company,
          plan: c.plan,
        };
      },
    }),

    draftEmail: tool({
      description:
        "Draft an email (does not send). Provide the recipient, subject, and body; returns the structured draft for review.",
      inputSchema: sendEmailPayload,
      execute: async ({ to, subject, body }) => ({ draft: { to, subject, body } }),
    }),

    sendEmail: tool({
      description:
        "Queue an email for sending. SENSITIVE: it is NOT sent immediately  it is queued for human approval and only sent once a person approves it.",
      inputSchema: sendEmailPayload,
      execute: async ({ to, subject, body }) => {
        const approval = await requestApproval(ctx.organizationId, {
          runId: approvalCtx.runId,
          actionType: "send_email",
          payload: { to, subject, body },
          requestedByAgent: "communication",
        });
        approvalCtx.emit?.(
          events.approvalRequired(
            approvalCtx.runId,
            approval.id,
            "send_email",
            "communication",
            summaryLine("send_email", { to, subject, body }),
          ),
        );
        return {
          queued: true,
          approvalId: approval.id,
          status: "pending_approval",
          note: "Email queued for human approval; it will send once approved.",
        };
      },
    }),

    createCRMTask: tool({
      description:
        "Queue a CRM task. SENSITIVE: creates a pending approval; the task is created only after a person approves it.",
      inputSchema: createCrmTaskPayload,
      execute: async ({ title, customerRef, notes }) => {
        const approval = await requestApproval(ctx.organizationId, {
          runId: approvalCtx.runId,
          actionType: "create_crm_task",
          payload: { title, customerRef, notes },
          requestedByAgent: "communication",
        });
        approvalCtx.emit?.(
          events.approvalRequired(
            approvalCtx.runId,
            approval.id,
            "create_crm_task",
            "communication",
            summaryLine("create_crm_task", { title, customerRef, notes }),
          ),
        );
        return { queued: true, approvalId: approval.id, status: "pending_approval" };
      },
    }),

    sendNotification: tool({
      description:
        "Send an in-app notification to the operator (internal, sent immediately  not an external action).",
      inputSchema: z.object({ title: z.string(), body: z.string().optional() }),
      execute: async ({ title, body }) => {
        await db.insert(notifications).values({
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          type: "agent",
          title,
          body: body ?? null,
        });
        return { sent: true };
      },
    }),
  };
}
