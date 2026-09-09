import { ChevronRight, Clock, Users, Wrench, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import type { RunSummary } from "@/services/runs";
import { Card, CardContent } from "@/components/ui/card";
import { StatusIcon, type IconStatus } from "@/components/ui/status-icon";
import { cn } from "cn";
import { formatDuration, relativeTime } from "@/lib/format";
import { formatUsd } from "@/lib/cost";
import { RunStatusBadge } from "./run-status-badge";

function iconStatus(status: string): IconStatus {
  if (status === "failed" || status === "cancelled") return "error";
  if (status === "completed") return "success";
  return "running";
}

function MetaItem({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1">
      <Icon className="size-3.5 opacity-70" /> {children}
    </span>
  );
}

function RunRow({ run }: { run: RunSummary }) {
  return (
    <Link
      href={`/activity/${run.id}`}
      className={cn(
        "group focus-visible:ring-ring flex items-center gap-3 rounded-lg px-3 py-3 outline-none transition-colors focus-visible:ring-2",
        "hover:bg-muted/60",
      )}
    >
      <StatusIcon status={iconStatus(run.status)} className="size-4 shrink-0" />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="truncate text-sm font-medium">{run.objective}</div>
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs">
          <MetaItem icon={Users}>
            {run.agentCount} {run.agentCount === 1 ? "agent" : "agents"}
          </MetaItem>
          <MetaItem icon={Wrench}>
            {run.toolCalls} {run.toolCalls === 1 ? "call" : "calls"}
          </MetaItem>
          <MetaItem icon={Clock}>{formatDuration(run.durationMs)}</MetaItem>
          <span className="tabular-nums">{formatUsd(run.estCostCents)}</span>
          <span className="text-muted-foreground/70">·</span>
          <span>{relativeTime(run.createdAt)}</span>
        </div>
      </div>
      <RunStatusBadge status={run.status} />
      <ChevronRight className="text-muted-foreground/50 size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

export function RunList({ runs, empty }: { runs: RunSummary[]; empty?: string }) {
  if (runs.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground text-sm">
          {empty ?? "No runs yet."}
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="py-2">
      <CardContent className="divide-border/50 divide-y px-1.5">
        {runs.map((r) => (
          <RunRow key={r.id} run={r} />
        ))}
      </CardContent>
    </Card>
  );
}
