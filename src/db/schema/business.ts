import { bigint, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import {
  customerStatus,
  invoiceStatus,
  riskLevel,
  subscriptionStatus,
  ticketStatus,
} from "./_enums";
import { createdAt, pk } from "./_helpers";
import { organizations } from "./organizations";

export const customers = pgTable(
  "customers",
  {
    id: pk(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    externalRef: text("external_ref").notNull(),
    name: text("name").notNull(),
    company: text("company"),
    email: text("email").notNull(),
    plan: text("plan"),
    mrrCents: bigint("mrr_cents", { mode: "number" }).notNull().default(0),
    lifetimeValueCents: bigint("lifetime_value_cents", { mode: "number" }).notNull().default(0),
    status: customerStatus("status").notNull().default("active"),
    riskLevel: riskLevel("risk_level").notNull().default("low"),
    healthScore: integer("health_score").notNull().default(100),
    /** Percentage change in usage, e.g. -34 means down 34%. */
    usageChangePct: integer("usage_change_pct").notNull().default(0),
    signedUpAt: timestamp("signed_up_at", { withTimezone: true }),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("customers_organization_id_idx").on(t.organizationId),
    index("customers_status_risk_idx").on(t.status, t.riskLevel),
  ],
);

export const orders = pgTable(
  "orders",
  {
    id: pk(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull().default(0),
    status: text("status").notNull().default("completed"),
    placedAt: timestamp("placed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("orders_organization_id_idx").on(t.organizationId),
    index("orders_customer_id_idx").on(t.customerId),
  ],
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: pk(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    plan: text("plan").notNull(),
    status: subscriptionStatus("status").notNull().default("active"),
    mrrCents: bigint("mrr_cents", { mode: "number" }).notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }),
    renewsAt: timestamp("renews_at", { withTimezone: true }),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
  },
  (t) => [
    index("subscriptions_organization_id_idx").on(t.organizationId),
    index("subscriptions_customer_id_idx").on(t.customerId),
  ],
);

export const invoices = pgTable(
  "invoices",
  {
    id: pk(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    number: text("number").notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull().default(0),
    status: invoiceStatus("status").notNull().default("open"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("invoices_organization_id_idx").on(t.organizationId),
    index("invoices_customer_id_idx").on(t.customerId),
    index("invoices_status_idx").on(t.status),
  ],
);

export const supportTickets = pgTable(
  "support_tickets",
  {
    id: pk(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    subject: text("subject").notNull(),
    category: text("category"),
    priority: text("priority").notNull().default("normal"),
    status: ticketStatus("status").notNull().default("open"),
    createdAt: createdAt(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [
    index("support_tickets_organization_id_idx").on(t.organizationId),
    index("support_tickets_customer_id_idx").on(t.customerId),
  ],
);

/** Activity events backing "usage declined N%" analysis. */
export const customerEvents = pgTable(
  "customer_events",
  {
    id: pk(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    value: integer("value").notNull().default(1),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    index("customer_events_customer_id_idx").on(t.customerId),
    index("customer_events_type_idx").on(t.type),
  ],
);
