import { Activity, CircleDollarSign, Clock, ShieldCheck } from "lucide-react";

import { requireUser } from "@/auth/dal";
import { AgentPerformance } from "@/components/runs/agent-performance";
import { BarList } from "@/components/charts/bar-list";
import { MiniBars, type MiniBar } from "@/components/charts/mini-bars";
import { KpiCard } from "@/components/runs/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatUsd } from "@/lib/cost";
import { formatDuration, formatNumber } from "@/lib/format";
import { getAnalytics } from "@/services/analytics";

export const metadata = { title: "Analytics" };

const DAY = 86_400_000;

/** Fill the last `days` days so the runs-over-time chart has a continuous axis. */
function runsSeries(runsByDay: { day: string; count: number }[], days = 14): MiniBar[] {
  const counts = new Map(runsByDay.map((r) => [r.day, r.count]));
  const today = new Date();
  const series: MiniBar[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * DAY);
    const key = d.toISOString().slice(0, 10);
    series.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, value: counts.get(key) ?? 0 });
  }
  return series;
}

export default async function AnalyticsPage() {
  const user = await requireUser();
  const a = await getAnalytics(user.organizationId);

  const totalRuns = a.runsByDay.reduce((sum, r) => sum + r.count, 0);
  const totalTokens = a.inputTokens + a.outputTokens;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <p className="text-muted-foreground text-sm">
        Trends across agent runs  throughput, tool usage, performance, and cost.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total runs" value={totalRuns} icon={Activity} tone="sky" />
        <KpiCard label="Avg duration" value={formatDuration(a.avgDurationMs)} icon={Clock} tone="violet" />
        <KpiCard
          label="Approval rate"
          value={`${a.approvalRate}%`}
          hint="approved & executed"
          icon={ShieldCheck}
          tone="emerald"
        />
        <KpiCard
          label="Est. AI cost"
          value={formatUsd(a.estCostCents)}
          icon={CircleDollarSign}
          tone="amber"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Runs over time</CardTitle>
          </CardHeader>
          <CardContent>
            <MiniBars data={runsSeries(a.runsByDay)} unit=" runs" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tokens</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList
              items={[
                { label: "Input", value: a.inputTokens },
                { label: "Output", value: a.outputTokens },
              ]}
            />
            <p className="text-muted-foreground mt-3 text-xs">
              {formatNumber(totalTokens)} tokens total
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top tools</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList items={a.toolUsage.map((t) => ({ label: t.tool, value: t.count }))} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Agent performance</CardTitle>
          </CardHeader>
          <CardContent>
            <AgentPerformance rates={a.agentPerformance} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
