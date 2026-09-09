import { ArrowRight, Plus } from "lucide-react";
import Link from "next/link";

import { requireUser } from "@/auth/dal";
import { TasksBoard } from "@/components/runs/tasks-board";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { listRuns } from "@/services/runs";

export const metadata = { title: "Tasks" };

export default async function TasksPage() {
  const user = await requireUser();
  const runs = await listRuns(user.organizationId, 50);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          Every objective you hand to the agents, with its status and progress.
        </p>
        <Button
          render={
            <Link href="/agent">
              <Plus className="size-4" /> New task
            </Link>
          }
        />
      </div>

      {runs.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground flex flex-col items-start gap-3 py-8 text-sm">
            <p>No tasks yet. Hand your AI team an objective to get started.</p>
            <Button
              variant="outline"
              render={
                <Link href="/agent">
                  Start a task <ArrowRight className="size-4" />
                </Link>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <TasksBoard runs={runs} />
      )}
    </div>
  );
}
