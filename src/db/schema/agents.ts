import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { agentKey, execStatus, runStatus, stepType } from "./_enums";
import { createdAt, pk } from "./_helpers";
import { organizations, users } from "./organizations";

/** Config/metadata per agent. Behavior lives in code (§30); this drives display + toggles. */
export const agents = pgTable(
  "agents",
  {
    id: pk(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    key: agentKey("key").notNull(),
    displayName: text("display_name").notNull(),
    description: text("description"),
    enabled: boolean("enabled").notNull().default(true),
    modelOverride: text("model_override"),
    createdAt: createdAt(),
  },
  (t) => [index("agents_organization_id_idx").on(t.organizationId)],
);

/** One execution of the multi-agent system for a user objective. */
export const agentRuns = pgTable(
  "agent_runs",
  {
    id: pk(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** FK added logically to tasks; kept nullable to avoid a hard cycle with tasks. */
    taskId: uuid("task_id"),
    objective: text("objective").notNull(),
    status: runStatus("status").notNull().default("pending"),
    /** Model id that powered the run (§40 cost tracking). */
    model: text("model"),
    /** Why the run ended: completed | max_steps | max_tool_calls | max_agent_hops | tool_timeout | budget_exceeded | error. */
    stopReason: text("stop_reason"),
    plan: jsonb("plan"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    totalSteps: integer("total_steps").notNull().default(0),
    totalToolCalls: integer("total_tool_calls").notNull().default(0),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    estimatedCostCents: bigint("estimated_cost_cents", {
      mode: "number",
    })
      .notNull()
      .default(0),
    finalResult: jsonb("final_result"),
    error: text("error"),
    createdAt: createdAt(),
  },
  (t) => [
    index("agent_runs_organization_id_idx").on(t.organizationId),
    index("agent_runs_user_id_idx").on(t.userId),
    index("agent_runs_status_idx").on(t.status),
  ],
);

/** A discrete step in a run's trace (plan, delegate, tool_call, review, …). */
export const agentSteps = pgTable(
  "agent_steps",
  {
    id: pk(),
    runId: uuid("run_id")
      .notNull()
      .references(() => agentRuns.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    agent: agentKey("agent").notNull(),
    stepIndex: integer("step_index").notNull(),
    type: stepType("type").notNull(),
    title: text("title"),
    input: jsonb("input"),
    output: jsonb("output"),
    status: execStatus("status").notNull().default("pending"),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index("agent_steps_run_id_idx").on(t.runId),
    // Analytics/Dashboard aggregate agent_steps by org, grouped by agent (§39, §44).
    index("agent_steps_org_agent_idx").on(t.organizationId, t.agent),
  ],
);

/** Messages exchanged between the user and agents (structured payloads, §28). */
export const agentMessages = pgTable(
  "agent_messages",
  {
    id: pk(),
    runId: uuid("run_id")
      .notNull()
      .references(() => agentRuns.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    agent: agentKey("agent"),
    content: jsonb("content").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("agent_messages_run_id_idx").on(t.runId)],
);

/** Every tool invocation, with full trace fields (§14). */
export const toolCalls = pgTable(
  "tool_calls",
  {
    id: pk(),
    runId: uuid("run_id")
      .notNull()
      .references(() => agentRuns.id, { onDelete: "cascade" }),
    stepId: uuid("step_id").references(() => agentSteps.id, {
      onDelete: "set null",
    }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    agent: agentKey("agent").notNull(),
    tool: text("tool").notNull(),
    input: jsonb("input"),
    output: jsonb("output"),
    status: execStatus("status").notNull().default("pending"),
    error: text("error"),
    durationMs: integer("duration_ms"),
    createdAt: createdAt(),
  },
  (t) => [
    index("tool_calls_run_id_idx").on(t.runId),
    index("tool_calls_tool_idx").on(t.tool),
    // Analytics aggregates tool_calls by org, grouped by tool (§39 top-tools).
    index("tool_calls_org_tool_idx").on(t.organizationId, t.tool),
  ],
);
