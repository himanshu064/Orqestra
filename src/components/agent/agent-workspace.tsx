"use client";

import { ActivityTimeline } from "@/components/agent/activity-timeline";
import { Conversation } from "@/components/agent/conversation";
import { TaskContext } from "@/components/agent/task-context";
import { TaskInput } from "@/components/agent/task-input";
import { useAgentRun } from "@/hooks/use-agent-run";

export function AgentWorkspace({ initialObjective }: { initialObjective?: string }) {
  const { run, activity, isStreaming } = useAgentRun();

  const retry = () => {
    if (activity.objective && !isStreaming) run(activity.objective);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <TaskInput onSubmit={run} disabled={isStreaming} initialText={initialObjective} />
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)_360px]">
        <TaskContext activity={activity} />
        <Conversation activity={activity} isStreaming={isStreaming} onRetry={retry} />
        <ActivityTimeline activity={activity} isStreaming={isStreaming} />
      </div>
    </div>
  );
}
