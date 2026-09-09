import type { ManagerReport } from "@/ai/agents/manager";
import type { AgentEvent } from "@/ai/events";
import type { AgentKey } from "@/ai/tools/registry";

export type RunStatus = "idle" | "running" | "completed" | "failed";

export type ToolActivity = { tool: string; status: "success" | "error"; durationMs: number };

export type AgentActivity = {
  key: AgentKey;
  status: "running" | "success" | "error";
  toolCalls: ToolActivity[];
  error?: string;
};

export type PendingApproval = { approvalId: string; actionType: string; summary: string };

export type ActivityState = {
  status: RunStatus;
  runId?: string;
  objective?: string;
  agents: AgentActivity[];
  approvals: PendingApproval[];
  report?: ManagerReport;
  error?: string;
  totals?: { steps: number; toolCalls: number };
};

/** Pure fold of the event stream into the timeline/report state the UI renders. */
export function reduceActivity(events: readonly AgentEvent[], objective?: string): ActivityState {
  const state: ActivityState = { status: "idle", objective, agents: [], approvals: [] };
  const byKey = new Map<AgentKey, AgentActivity>();

  const ensure = (key: AgentKey): AgentActivity => {
    let a = byKey.get(key);
    if (!a) {
      a = { key, status: "running", toolCalls: [] };
      byKey.set(key, a);
      state.agents.push(a);
    }
    return a;
  };

  for (const e of events) {
    switch (e.type) {
      case "run.started":
        state.status = "running";
        state.runId = e.runId;
        if (e.objective) state.objective = e.objective;
        break;
      case "agent.started":
        ensure(e.agent).status = "running";
        break;
      case "tool.completed":
        ensure(e.agent).toolCalls.push({
          tool: e.tool,
          status: e.status,
          durationMs: e.durationMs,
        });
        break;
      case "agent.completed":
        ensure(e.agent).status = "success";
        break;
      case "agent.failed": {
        const a = ensure(e.agent);
        a.status = "error";
        a.error = e.error;
        break;
      }
      case "approval.required":
        state.approvals.push({
          approvalId: e.approvalId,
          actionType: e.actionType,
          summary: e.summary,
        });
        break;
      case "run.completed":
        state.status = "completed";
        state.report = e.result as ManagerReport;
        state.totals = e.totals;
        break;
      case "run.failed":
        state.status = "failed";
        state.error = e.error;
        break;
    }
  }

  return state;
}
