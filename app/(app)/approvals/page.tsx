import { requireUser } from "@/auth/dal";
import { ApprovalsList, type ApprovalItem } from "@/components/approvals/approvals-list";
import { AGENT_META } from "@/config/agents";
import { listApprovals } from "@/services/approvals";

export const metadata = { title: "Approvals" };

export default async function ApprovalsPage() {
  const user = await requireUser();
  const rows = await listApprovals(user.organizationId);

  const items: ApprovalItem[] = rows.map((r) => ({
    id: r.id,
    actionType: r.actionType,
    status: r.status,
    requestedByAgent: r.requestedByAgent as keyof typeof AGENT_META,
    requestedAt: r.requestedAt?.toISOString() ?? null,
    payload: r.payload,
    runObjective: r.runObjective ?? null,
    executionResult: r.executionResult ?? null,
  }));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Approvals</h2>
        <p className="text-muted-foreground text-sm">
          Review and approve sensitive actions before they execute. Nothing is sent until you
          approve it.
        </p>
      </div>

      <ApprovalsList items={items} />
    </div>
  );
}
