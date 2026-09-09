import type { AgentKey } from "@/ai/tools/registry";

export type ExecStatus = "success" | "error";

/** Standardized agent run event stream (requirements §34). */
export type AgentEvent =
  | { type: "run.started"; runId: string; at: string; objective: string }
  | { type: "agent.started"; runId: string; at: string; agent: AgentKey; title?: string }
  | { type: "agent.completed"; runId: string; at: string; agent: AgentKey; summary?: string }
  | { type: "agent.failed"; runId: string; at: string; agent: AgentKey; error: string }
  | {
      type: "tool.completed";
      runId: string;
      at: string;
      agent: AgentKey;
      tool: string;
      status: ExecStatus;
      durationMs: number;
      output?: unknown;
    }
  | {
      type: "approval.required";
      runId: string;
      at: string;
      approvalId: string;
      actionType: string;
      agent: AgentKey;
      summary: string;
    }
  | {
      type: "run.completed";
      runId: string;
      at: string;
      result: unknown;
      totals: { steps: number; toolCalls: number };
    }
  | { type: "run.failed"; runId: string; at: string; error: string };

export type AgentEventType = AgentEvent["type"];

const now = () => new Date().toISOString();

export const events = {
  runStarted: (runId: string, objective: string): AgentEvent => ({
    type: "run.started",
    runId,
    at: now(),
    objective,
  }),
  agentStarted: (runId: string, agent: AgentKey, title?: string): AgentEvent => ({
    type: "agent.started",
    runId,
    at: now(),
    agent,
    title,
  }),
  agentCompleted: (runId: string, agent: AgentKey, summary?: string): AgentEvent => ({
    type: "agent.completed",
    runId,
    at: now(),
    agent,
    summary,
  }),
  agentFailed: (runId: string, agent: AgentKey, error: string): AgentEvent => ({
    type: "agent.failed",
    runId,
    at: now(),
    agent,
    error,
  }),
  toolCompleted: (
    runId: string,
    agent: AgentKey,
    tool: string,
    status: ExecStatus,
    durationMs: number,
    output?: unknown,
  ): AgentEvent => ({
    type: "tool.completed",
    runId,
    at: now(),
    agent,
    tool,
    status,
    durationMs,
    output,
  }),
  approvalRequired: (
    runId: string,
    approvalId: string,
    actionType: string,
    agent: AgentKey,
    summary: string,
  ): AgentEvent => ({
    type: "approval.required",
    runId,
    at: now(),
    approvalId,
    actionType,
    agent,
    summary,
  }),
  runCompleted: (
    runId: string,
    result: unknown,
    totals: { steps: number; toolCalls: number },
  ): AgentEvent => ({ type: "run.completed", runId, at: now(), result, totals }),
  runFailed: (runId: string, error: string): AgentEvent => ({
    type: "run.failed",
    runId,
    at: now(),
    error,
  }),
};

/** Serialize an event as an SSE frame. */
export function toSseFrame(event: AgentEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}
