"use client";

import { ClipboardList } from "lucide-react";

import { AGENT_META } from "@/config/agents";
import type { ActivityState } from "@/lib/agent-activity";
import { ACTIVITY_STATUS_META } from "@/lib/status";
import { Tag } from "@/components/ui/tag";

export function TaskContext({ activity }: { activity: ActivityState }) {
  const status = ACTIVITY_STATUS_META[activity.status];

  return (
    <div className="bg-card flex h-full min-h-0 flex-col overflow-hidden rounded-xl border">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <ClipboardList className="text-muted-foreground size-4" />
        <h3 className="text-sm font-semibold">Task</h3>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        <div className="space-y-1.5">
          <div className="text-muted-foreground text-xs font-semibold uppercase">Objective</div>
          <p className="text-sm">{activity.objective ?? "No task running."}</p>
        </div>

        <div className="space-y-1.5">
          <div className="text-muted-foreground text-xs font-semibold uppercase">Status</div>
          <Tag tone={status.tone} className="h-6 px-2.5 text-xs">
            {status.label}
          </Tag>
        </div>

        {activity.agents.length > 0 ? (
          <div className="space-y-2">
            <div className="text-muted-foreground text-xs font-semibold uppercase">Agents</div>
            <ul className="space-y-1.5">
              {activity.agents.map((a) => {
                const meta = AGENT_META[a.key];
                const Icon = meta.icon;
                return (
                  <li key={a.key} className="flex items-center gap-2 text-sm">
                    <Icon className="text-muted-foreground size-4" />
                    {meta.short}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
