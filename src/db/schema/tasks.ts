import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { agentKey, approvalStatus, runStatus } from "./_enums";
import { createdAt, pk, updatedAt } from "./_helpers";
import { agentRuns, agentSteps } from "./agents";
import { organizations, users } from "./organizations";

/** User-facing wrapper over a run (§17). agent_runs holds the execution detail. */
export const tasks = pgTable(
  "tasks",
  {
    id: pk(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    runId: uuid("run_id").references(() => agentRuns.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    status: runStatus("status").notNull().default("pending"),
    progress: integer("progress").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("tasks_organization_id_idx").on(t.organizationId),
    index("tasks_user_id_idx").on(t.userId),
  ],
);

/** Sensitive-action approval record. Executed at-most-once via idempotency_key (Appendix A.6). */
export const approvals = pgTable(
  "approvals",
  {
    id: pk(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    runId: uuid("run_id")
      .notNull()
      .references(() => agentRuns.id, { onDelete: "cascade" }),
    stepId: uuid("step_id").references(() => agentSteps.id, {
      onDelete: "set null",
    }),
    actionType: text("action_type").notNull(),
    payload: jsonb("payload").notNull(),
    status: approvalStatus("status").notNull().default("pending"),
    requestedByAgent: agentKey("requested_by_agent").notNull(),
    decidedByUserId: uuid("decided_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    executedAt: timestamp("executed_at", { withTimezone: true }),
    executionResult: jsonb("execution_result"),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    createdAt: createdAt(),
  },
  (t) => [
    index("approvals_organization_id_idx").on(t.organizationId),
    index("approvals_run_id_idx").on(t.runId),
    index("approvals_status_idx").on(t.status),
  ],
);
