import "dotenv/config";

import { neon } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import bcrypt from "bcryptjs";

import * as schema from "../src/db/schema";

async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    console.error("Usage: tsx scripts/set-password.ts <email> <password>");
    process.exit(1);
  }

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  const db = drizzle(neon(url), { schema, casing: "snake_case" });

  const hashed = await bcrypt.hash(password, 10);
  const updated = await db
    .update(schema.users)
    .set({ hashedPassword: hashed, updatedAt: new Date() })
    .where(eq(schema.users.email, email.toLowerCase()))
    .returning({ id: schema.users.id, email: schema.users.email });

  if (updated.length === 0) {
    console.error(`✗ No user found with email ${email}`);
    process.exit(1);
  }
  console.log(`✓ Password set for ${updated[0]!.email}`);
}

main().catch((err) => {
  console.error("✗ set-password failed:", err);
  process.exit(1);
});
