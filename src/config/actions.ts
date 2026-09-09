import { Mail, Ticket, type LucideIcon } from "lucide-react";
import { z } from "zod";

/**
 * Single source of truth for sensitive agent actions (§26, §37). Defines each action's payload
 * shape, display icon, and human summary once  consumed by the Communication tools (build +
 * validate payload), the approval engine (dispatch/execute lives server-side in `approvals.ts`),
 * and the Approvals UI (icon + summary). Client-safe: no server-only imports.
 */

export const sendEmailPayload = z.object({
  to: z.string(),
  subject: z.string(),
  body: z.string(),
});

export const createCrmTaskPayload = z.object({
  title: z.string(),
  customerRef: z.string().optional(),
  notes: z.string().optional(),
});

type ActionMeta = {
  icon: LucideIcon;
  summarize: (payload: unknown) => { title: string; detail: string };
};

export const ACTION_META: Record<string, ActionMeta> = {
  send_email: {
    icon: Mail,
    summarize: (payload) => {
      const p = (payload ?? {}) as Record<string, unknown>;
      return {
        title: `Send email to ${String(p.to ?? "recipient")}`,
        detail: String(p.subject ?? ""),
      };
    },
  },
  create_crm_task: {
    icon: Ticket,
    summarize: (payload) => {
      const p = (payload ?? {}) as Record<string, unknown>;
      return { title: `Create CRM task: ${String(p.title ?? "")}`, detail: String(p.notes ?? "") };
    },
  },
};

export function summarizeAction(
  actionType: string,
  payload: unknown,
): { title: string; detail: string } {
  return ACTION_META[actionType]?.summarize(payload) ?? { title: actionType, detail: "" };
}
