import { ArrowLeft, Clock, Coins, DollarSign, Lightbulb, TriangleAlert, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireUser } from "@/auth/dal";
import { AGENT_META } from "@/config/agents";
import { RunStatusBadge } from "@/components/runs/run-status-badge";
import { TraceView, type TraceCall, type TraceStep } from "@/components/runs/trace-view";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { estimateCostCents, formatUsd } from "@/lib/cost";
import { formatDuration, formatNumber, relativeTime } from "@/lib/format";
import { getRunTrace } from "@/services/runs";

export const metadata = { title: "Run trace" };

function durationMs(startedAt: Date | null, completedAt: Date | null): number | null {
  if (!startedAt || !completedAt) return null;
  return Math.max(0, completedAt.getTime() - startedAt.getTime());
}

function Stat({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
  return (
    <div className="flex items-center gap-3">
      <span className="bg-muted text-muted-foreground grid size-9 shrink-0 place-items-center rounded-lg">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 space-y-0.5">
        <div className="text-muted-foreground text-xs">{label}</div>
        <div className="truncate text-sm font-semibold tabular-nums">{value}</div>
      </div>
    </div>
  );
}

export default async function RunTracePage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const user = await requireUser();
  const trace = await getRunTrace(user.organizationId, runId);
  if (!trace) notFound();

  const { run, steps, calls } = trace;

  const traceSteps: TraceStep[] = steps.map((s) => ({
    id: s.id,
    agent: s.agent,
    type: s.type,
    title: s.title,
    status: s.status,
    output: s.output,
  }));
  const traceCalls: TraceCall[] = calls.map((c) => ({
    id: c.id,
    stepId: c.stepId,
    agent: c.agent,
    tool: c.tool,
    input: c.input,
    output: c.output,
    status: c.status,
    durationMs: c.durationMs,
  }));

  const agents = Array.from(new Set(steps.map((s) => s.agent)));
  const cost = run.estimatedCostCents || estimateCostCents(run.model, run.inputTokens, run.outputTokens);
  const summary =
    run.finalResult && typeof run.finalResult === "object" && "summary" in run.finalResult
      ? String((run.finalResult as { summary: unknown }).summary)
      : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/activity"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> Back to activity
      </Link>

      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-tight">{run.objective}</h2>
          <RunStatusBadge status={run.status} />
        </div>
        <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
          {agents.map((a) => (
            <Tag key={a} tone="neutral">
              {AGENT_META[a]?.short ?? a}
            </Tag>
          ))}
          {run.model ? (
            <Tag tone="outline" mono uppercaseFirst={false}>
              {run.model}
            </Tag>
          ) : null}
          <span className="text-muted-foreground/70">
            · started {relativeTime(run.createdAt.toISOString())}
          </span>
        </div>
      </div>

      <Card>
        <CardContent className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
          <Stat
            icon={Clock}
            label="Duration"
            value={formatDuration(durationMs(run.startedAt, run.completedAt))}
          />
          <Stat icon={Wrench} label="Tool calls" value={formatNumber(run.totalToolCalls)} />
          <Stat
            icon={Coins}
            label="Tokens"
            value={`${formatNumber(run.inputTokens)} in · ${formatNumber(run.outputTokens)} out`}
          />
          <Stat icon={DollarSign} label="Est. cost" value={formatUsd(cost)} />
        </CardContent>
      </Card>

      {summary ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Lightbulb className="size-4" />
              </span>
              Result
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-relaxed">{summary}</CardContent>
        </Card>
      ) : null}

      {run.error ? (
        <Card>
          <CardContent className="space-y-1">
            <div className="text-destructive flex items-center gap-2 text-sm font-medium">
              <TriangleAlert className="size-4" />
              Run {run.stopReason && run.stopReason !== "error" ? `stopped (${run.stopReason})` : "failed"}
            </div>
            <p className="text-muted-foreground text-sm">{run.error}</p>
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Execution trace</h3>
        <TraceView steps={traceSteps} calls={traceCalls} />
      </div>
    </div>
  );
}
