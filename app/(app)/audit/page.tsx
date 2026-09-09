import { Lock } from "lucide-react";

import { requireUser } from "@/auth/dal";
import { AuditList } from "@/components/audit/audit-list";
import { listAuditLogs } from "@/services/audit";

export const metadata = { title: "Audit Log" };

export default async function AuditPage() {
  const user = await requireUser();
  const entries = await listAuditLogs(user.organizationId, 100);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="border-border/60 text-muted-foreground flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs">
        <Lock className="size-3.5 shrink-0" />
        Append-only record of every important action. Entries cannot be edited or deleted from the
        interface.
      </div>

      <AuditList entries={entries} />
    </div>
  );
}
