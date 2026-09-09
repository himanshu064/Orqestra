"use client";

import { Activity, Check } from "lucide-react";

import { AGENT_META } from "@/config/agents";
import { StatusIcon } from "@/components/ui/status-icon";
import type { ActivityState } from "@/lib/agent-activity";
import { cn } from "@/lib/utils";

export function ActivityTimeline({
  activity,
  isStreaming,
}: {
  activity: ActivityState;
  isStreaming: boolean;
}) {
  const empty = activity.agents.length === 0;

  return (
    <div className="bg-card flex h-full min-h-0 flex-col overflow-hidden rounded-xl border">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Activity className="text-muted-foreground size-4" />
          <h3 className="text-sm font-semibold">Agent Activity</h3>
        </div>
        {isStreaming ? (
          <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            live
          </span>
        ) : null}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {empty ? (
          <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-3 text-center">
            <div className="bg-muted grid size-11 place-items-center rounded-full">
              <Activity className="size-5" />
            </div>
            <p className="max-w-[15rem] text-sm">
              Agent and tool activity will stream here as the run progresses.
            </p>
          </div>
        ) : (
          activity.agents.map((agent) => {
            const meta = AGENT_META[agent.key];
            const Icon = meta.icon;
            return (
              <div key={agent.key} className="space-y-2">
                <div className="flex items-center gap-2">
                  <StatusIcon status={agent.status} className="size-4" />
                  <Icon className="text-muted-foreground size-4" />
                  <span className="text-sm font-medium">{meta.label}</span>
                </div>
                {agent.toolCalls.length > 0 ? (
                  <ul className="border-muted ml-2 space-y-1 border-l pl-4">
                    {agent.toolCalls.map((t, i) => (
                      <li
                        key={`${t.tool}-${i}`}
                        className="text-muted-foreground flex items-center gap-2 text-xs"
                      >
                        <Check
                          className={cn(
                            "size-3",
                            t.status === "success"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-destructive",
                          )}
                        />
                        <code className="text-foreground">{t.tool}</code>
                        {t.durationMs > 0 ? <span>· {t.durationMs}ms</span> : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {agent.error ? (
                  <p className="text-destructive ml-6 text-xs">{agent.error}</p>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
