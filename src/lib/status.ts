import type { TagTone } from "@/components/ui/tag";

/**
 * Central status → {label, tone} vocabulary so the same status reads identically everywhere
 * (run badges, task cards, the agent console). Tones map to the shared palette in `ui/tag`.
 */

/** Run lifecycle (`agent_runs.status`). */
export const RUN_STATUS_META: Record<string, { label: string; tone: TagTone }> = {
  completed: { label: "Completed", tone: "emerald" },
  running: { label: "Running", tone: "sky" },
  planning: { label: "Planning", tone: "sky" },
  pending: { label: "Pending", tone: "neutral" },
  waiting_for_approval: { label: "Awaiting approval", tone: "amber" },
  failed: { label: "Failed", tone: "rose" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export function runStatusMeta(status: string): { label: string; tone: TagTone } {
  return RUN_STATUS_META[status] ?? { label: status, tone: "neutral" };
}

/** Live agent-console activity status (`ActivityState.status`). */
export const ACTIVITY_STATUS_META: Record<"idle" | "running" | "completed" | "failed", { label: string; tone: TagTone }> =
  {
    idle: { label: "Idle", tone: "neutral" },
    running: { label: "Running", tone: "sky" },
    completed: { label: "Completed", tone: "emerald" },
    failed: { label: "Failed", tone: "rose" },
  };
