"use server";

import { revalidatePath } from "next/cache";

import { hasRole, PRIVILEGED_ROLES, requireUser } from "@/auth/dal";
import { approveApproval, rejectApproval } from "@/services/approvals";

export type ApprovalActionResult = { ok: boolean; message: string };

const FORBIDDEN = "You don't have permission to decide approvals.";

export async function approveApprovalAction(id: string): Promise<ApprovalActionResult> {
  const user = await requireUser();
  if (!hasRole(user, PRIVILEGED_ROLES)) return { ok: false, message: FORBIDDEN };
  const res = await approveApproval(user.organizationId, user.id, id);
  revalidatePath("/approvals");
  if (res.ok) {
    return {
      ok: true,
      message: res.alreadyExecuted
        ? "Already executed."
        : (res.summary ?? "Approved and executed."),
    };
  }
  return { ok: false, message: res.reason };
}

export async function rejectApprovalAction(id: string): Promise<ApprovalActionResult> {
  const user = await requireUser();
  if (!hasRole(user, PRIVILEGED_ROLES)) return { ok: false, message: FORBIDDEN };
  const res = await rejectApproval(user.organizationId, user.id, id);
  revalidatePath("/approvals");
  return res.ok ? { ok: true, message: "Rejected." } : { ok: false, message: res.reason };
}
