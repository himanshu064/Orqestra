"use client";

import { AlertCircle, Bot, Loader2, RotateCw, ShieldAlert, User } from "lucide-react";
import Link from "next/link";

import type { ActivityState } from "@/lib/agent-activity";
import { Button } from "@/components/ui/button";

import { ReportView } from "./report-view";

export function Conversation({
  activity,
  isStreaming,
  onRetry,
}: {
  activity: ActivityState;
  isStreaming: boolean;
  onRetry?: () => void;
}) {
  return (
    <div className="bg-card flex h-full min-h-0 flex-col overflow-hidden rounded-xl border">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Bot className="text-muted-foreground size-4" />
        <h3 className="text-sm font-semibold">Conversation</h3>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {!activity.objective ? (
          <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-3 text-center">
            <div className="bg-muted grid size-11 place-items-center rounded-full">
              <Bot className="size-5" />
            </div>
            <p className="max-w-xs text-sm">
              Enter an objective above to start a run. The AI team will plan, delegate to
              specialists, and report back here.
            </p>
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <div className="bg-muted flex size-7 shrink-0 items-center justify-center rounded-full">
                <User className="size-4" />
              </div>
              <div className="bg-muted rounded-lg px-3 py-2 text-sm">{activity.objective}</div>
            </div>

            <div className="flex gap-2">
              <div className="bg-primary text-primary-foreground flex size-7 shrink-0 items-center justify-center rounded-full">
                <Bot className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                {activity.status === "failed" ? (
                  <div className="text-destructive border-destructive/30 bg-destructive/10 space-y-2 rounded-lg border px-3 py-2 text-sm">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="mt-0.5 size-4 shrink-0" />
                      <span>{activity.error ?? "The run failed."}</span>
                    </div>
                    {onRetry ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={onRetry}
                        disabled={isStreaming}
                      >
                        <RotateCw className="size-3.5" /> Retry
                      </Button>
                    ) : null}
                  </div>
                ) : activity.report ? (
                  <div className="space-y-3">
                    {activity.approvals.length > 0 ? (
                      <Link
                        href="/approvals"
                        className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 hover:underline dark:text-amber-400"
                      >
                        <ShieldAlert className="size-4 shrink-0" />
                        {activity.approvals.length} action
                        {activity.approvals.length === 1 ? "" : "s"} require approval  review in
                        Approvals
                      </Link>
                    ) : null}
                    <ReportView report={activity.report} totals={activity.totals} />
                  </div>
                ) : (
                  <div className="text-muted-foreground flex items-center gap-2 text-sm">
                    <Loader2 className="size-4 animate-spin" />
                    {isStreaming ? "The AI team is working…" : "Preparing…"}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
