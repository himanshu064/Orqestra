import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";

/**
 * Read model for the audit trail (§38). The audit log is append-only  this module intentionally
 * exposes no update/delete path, so the trail is immutable from the UI. Writes happen only in the
 * approval engine via its internal `writeAudit`.
 */

export type AuditEntry = {
  id: string;
  actorType: string;
  actorLabel: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  result: string | null;
  metadata: unknown;
  createdAt: string;
};

export async function listAuditLogs(orgId: string, limit = 100): Promise<AuditEntry[]> {
  const rows = await db
    .select({
      id: auditLogs.id,
      actorType: auditLogs.actorType,
      actorId: auditLogs.actorId,
      actorName: users.name,
      actorEmail: users.email,
      action: auditLogs.action,
      targetType: auditLogs.targetType,
      targetId: auditLogs.targetId,
      result: auditLogs.result,
      metadata: auditLogs.metadata,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.actorId, users.id))
    .where(eq(auditLogs.organizationId, orgId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    actorType: r.actorType,
    actorLabel:
      r.actorType === "user"
        ? (r.actorName ?? r.actorEmail ?? "User")
        : r.actorType === "agent"
          ? "Agent"
          : "System",
    action: r.action,
    targetType: r.targetType,
    targetId: r.targetId,
    result: r.result,
    metadata: r.metadata,
    createdAt: r.createdAt.toISOString(),
  }));
}
