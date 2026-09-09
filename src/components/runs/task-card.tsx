import { Clock, Users, Wrench } from "lucide-react";
import Link from "next/link";

import type { RunSummary } from "@/services/runs";
import { Card, CardContent } from "@/components/ui/card";
import { formatDuration, relativeTime } from "@/lib/format";
import { formatUsd } from "@/lib/cost";
import { RunStatusBadge } from "./run-status-badge";

/** Progress heuristic for the Tasks view: terminal states are 100%, in-flight ~ partial. */
function progressFor(status: string): number {
  switch (status) {
    case "completed":
    case "failed":
    case "cancelled":
      return 100;
    case "running":
      return 66;
    case "planning":
      return 33;
    case "waiting_for_approval":
      return 80;
    default:
      return 10;
  }
}

function barColor(status: string): string {
  if (status === "failed") return "bg-rose-500";
  if (status === "completed") return "bg-emerald-500";
  if (status === "waiting_for_approval") return "bg-amber-500";
  return "bg-sky-500";
}

export function TaskCard({ run }: { run: RunSummary }) {
  const progress = progressFor(run.status);

  return (
    <Link
      href={`/activity/${run.id}`}
      className="focus-visible:ring-ring block rounded-xl outline-none focus-visible:ring-2"
    >
      <Card className="hover:ring-foreground/20 h-full gap-3 transition-shadow hover:shadow-sm">
        <CardContent className="flex h-full flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <div className="line-clamp-2 text-sm font-medium">{run.objective}</div>
            <RunStatusBadge status={run.status} />
          </div>

          <div className="mt-auto space-y-2">
            <div className="bg-muted h-1.5 overflow-hidden rounded-full">
              <div
                className={`h-full rounded-full ${barColor(run.status)}`}
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <span className="inline-flex items-center gap-1">
                <Users className="size-3.5 opacity-70" /> {run.agentCount}
              </span>
              <span className="inline-flex items-center gap-1">
                <Wrench className="size-3.5 opacity-70" /> {run.toolCalls}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3.5 opacity-70" /> {formatDuration(run.durationMs)}
              </span>
              <span className="tabular-nums">{formatUsd(run.estCostCents)}</span>
              <span className="ml-auto">{relativeTime(run.createdAt)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
