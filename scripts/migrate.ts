import "dotenv/config";

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");

  const sql = neon(url);

  // 1) pgvector must exist before any `vector` column is created.
  await sql`CREATE EXTENSION IF NOT EXISTS vector`;
  console.log("✓ pgvector ready");

  // 2) apply generated migrations from ./drizzle
  const db = drizzle(sql);
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("✓ migrations applied");
}

main().catch((err) => {
  console.error("✗ migrate failed:", err);
  process.exit(1);
});
