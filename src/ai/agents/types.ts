/** A single tool invocation captured from an agent run (persisted in Phase 7). */
export type ToolCallTrace = {
  tool: string;
  input: unknown;
  output: unknown;
};

/** A finished AI SDK step (structural  matches generateText's onStepFinish arg). */
export type StepLike = {
  toolCalls?: ReadonlyArray<{ toolName: string; toolCallId: string; input?: unknown }>;
  toolResults?: ReadonlyArray<{ toolCallId: string; output?: unknown }>;
  usage?: { inputTokens?: number; outputTokens?: number };
};

/** Token usage for an agent run (feeds cost tracking in Phase 12). */
export type AgentUsage = {
  inputTokens: number;
  outputTokens: number;
};

/** Generic result envelope returned by every agent. */
export type AgentResult<Findings> = {
  findings: Findings;
  toolCalls: ToolCallTrace[];
  usage: AgentUsage;
  /** The agent's free-text analysis (before structuring). */
  text: string;
};
