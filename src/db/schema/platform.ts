import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { actorType } from "./_enums";
import { createdAt, pk } from "./_helpers";
import { organizations, users } from "./organizations";

export const notifications = pgTable(
  "notifications",
  {
    id: pk(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_id_idx").on(t.userId)],
);

/** Append-only audit trail (§38). No update/delete paths are built against this table. */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: pk(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    actorType: actorType("actor_type").notNull(),
    actorId: uuid("actor_id"),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    metadata: jsonb("metadata"),
    result: text("result"),
    createdAt: createdAt(),
  },
  (t) => [
    index("audit_logs_organization_id_idx").on(t.organizationId),
    index("audit_logs_action_idx").on(t.action),
  ],
);
