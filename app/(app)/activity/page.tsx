import { requireUser } from "@/auth/dal";
import { RunList } from "@/components/runs/run-list";
import { listRuns } from "@/services/runs";

export const metadata = { title: "Activity" };

export default async function ActivityPage() {
  const user = await requireUser();
  const runs = await listRuns(user.organizationId, 100);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Activity</h2>
        <p className="text-muted-foreground text-sm">
          Full history of agent runs. Select a run to inspect its execution trace.
        </p>
      </div>

      <RunList runs={runs} empty="No activity yet  runs will appear here as agents work." />
    </div>
  );
}
