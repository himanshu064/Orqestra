import { Activity, ArrowRight, CheckCircle2, CircleDollarSign, ListChecks, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { cn } from "cn";

import { requireUser } from "@/auth/dal";
import { FEATURED_TEMPLATES } from "@/config/scenarios";
import { TONE_CLASS } from "@/components/ui/tag";
import { AgentPerformance } from "@/components/runs/agent-performance";
import { KpiCard } from "@/components/runs/kpi-card";
import { RunList } from "@/components/runs/run-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatUsd } from "@/lib/cost";
import { getCostSummary, getDashboardStats } from "@/services/analytics";
import { recentRuns } from "@/services/runs";

export const metadata = { title: "Dashboard" };

function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage() {
  const user = await requireUser();
  const orgId = user.organizationId;
  const [stats, runs, cost] = await Promise.all([
    getDashboardStats(orgId),
    recentRuns(orgId, 6),
    getCostSummary(orgId),
  ]);

  const successRate = stats.totalRuns
    ? Math.round((stats.successfulRuns / stats.totalRuns) * 100)
    : 0;
  const firstName = user.name?.split(" ")[0] ?? "there";

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Hero */}
      <section className="from-muted/60 to-muted/10 border-border relative overflow-hidden rounded-2xl border bg-gradient-to-br p-6 sm:p-8">
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1.5">
            <p className="text-muted-foreground text-sm">{greeting()},</p>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{firstName}</h2>
            <p className="text-muted-foreground max-w-md text-sm">
              What would you like your AI team to accomplish today?
            </p>
          </div>
          <Button
            size="lg"
            render={
              <Link href="/agent">
                Start a new task <ArrowRight className="size-4" />
              </Link>
            }
          />
        </div>
      </section>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total runs" value={stats.totalRuns} icon={Activity} tone="sky" />
        <KpiCard
          label="Successful"
          value={stats.successfulRuns}
          hint={`${successRate}% success rate`}
          icon={CheckCircle2}
          tone="emerald"
        />
        <KpiCard
          label="Tasks completed"
          value={stats.tasksCompleted}
          icon={ListChecks}
          tone="violet"
        />
        <KpiCard
          label="Pending approvals"
          value={stats.pendingApprovals}
          hint={stats.pendingApprovals > 0 ? "Needs your review" : "All clear"}
          icon={ShieldAlert}
          tone={stats.pendingApprovals > 0 ? "amber" : "neutral"}
        />
      </div>

      {/* Featured scenarios */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Start from a scenario</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          {FEATURED_TEMPLATES.map((t) => {
            const Icon = t.icon;
            return (
              <Link
                key={t.id}
                href={`/agent?template=${t.id}`}
                className="group focus-visible:ring-ring block rounded-xl outline-none focus-visible:ring-2"
              >
                <Card className="hover:ring-foreground/20 h-full transition-shadow hover:shadow-sm">
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span
                        className={cn("grid size-8 place-items-center rounded-lg", TONE_CLASS.violet)}
                      >
                        <Icon className="size-4" />
                      </span>
                      <ArrowRight className="text-muted-foreground/50 size-4 transition-transform group-hover:translate-x-0.5" />
                    </div>
                    <div className="text-sm font-medium">{t.title}</div>
                    <div className="text-muted-foreground text-xs">{t.description}</div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Main grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-semibold">Recent runs</h3>
            <Link
              href="/activity"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs transition-colors"
            >
              View all <ArrowRight className="size-3" />
            </Link>
          </div>
          <RunList runs={runs} empty="No runs yet  start one to see it here." />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <span className={cn("grid size-7 place-items-center rounded-lg", TONE_CLASS.emerald)}>
                  <CircleDollarSign className="size-4" />
                </span>
                Estimated AI cost
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-border grid grid-cols-2 divide-x">
                <div className="space-y-0.5 pr-4">
                  <div className="text-muted-foreground text-xs">Today</div>
                  <div className="text-2xl font-semibold tabular-nums">
                    {formatUsd(cost.todayCents)}
                  </div>
                </div>
                <div className="space-y-0.5 pl-4">
                  <div className="text-muted-foreground text-xs">This month</div>
                  <div className="text-2xl font-semibold tabular-nums">
                    {formatUsd(cost.monthCents)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Agent performance</CardTitle>
            </CardHeader>
            <CardContent>
              <AgentPerformance rates={stats.agentSuccessRates} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
