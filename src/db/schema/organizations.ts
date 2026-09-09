import { index, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { userRole } from "./_enums";
import { createdAt, pk, updatedAt } from "./_helpers";

export const organizations = pgTable("organizations", {
  id: pk(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const users = pgTable(
  "users",
  {
    id: pk(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: text("email").notNull().unique(),
    name: text("name"),
    /** Nullable: OAuth users (V2) may not have a password. */
    hashedPassword: text("hashed_password"),
    role: userRole("role").notNull().default("manager"),
    image: text("image"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("users_organization_id_idx").on(t.organizationId)],
);
