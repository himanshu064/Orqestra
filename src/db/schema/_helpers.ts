import { sql } from "drizzle-orm";
import { timestamp, uuid } from "drizzle-orm/pg-core";

/** UUID primary key defaulting to a DB-generated v4 (gen_random_uuid, built into PG 13+). */
export const pk = () =>
  uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`);

/** `created_at timestamptz not null default now()`. */
export const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

/** `updated_at timestamptz not null default now()`, bumped by the app on write. */
export const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
