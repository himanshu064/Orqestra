import "dotenv/config";

import { neon } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "../src/db/schema";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");

  const client = neon(url);
  const db = drizzle(client, { schema, casing: "snake_case" });

  // --- pgvector present? ---
  const ext = await client`SELECT extname FROM pg_extension WHERE extname = 'vector'`;
  console.log(`pgvector extension: ${ext.length ? "present ✓" : "MISSING ✗"}`);

  // --- how many tables did we create? ---
  const tables =
    await client`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`;
  const names = tables.map((r) => r.table_name as string);
  console.log(`public tables (${names.length}): ${names.join(", ")}`);

  // --- read/write round trip ---
  const slug = `smoke-${Date.now()}`;
  const [org] = await db
    .insert(schema.organizations)
    .values({ name: "Smoke Test Org", slug })
    .returning();
  if (!org) throw new Error("insert returned no row");
  console.log(`inserted organization ${org.id}`);

  const found = await db
    .select()
    .from(schema.organizations)
    .where(eq(schema.organizations.id, org.id));
  if (found.length !== 1) throw new Error("select did not return the inserted row");
  console.log("selected it back ✓");

  await db.delete(schema.organizations).where(eq(schema.organizations.id, org.id));
  const afterDelete = await db
    .select()
    .from(schema.organizations)
    .where(eq(schema.organizations.id, org.id));
  if (afterDelete.length !== 0) throw new Error("row was not deleted");
  console.log("deleted it ✓");

  console.log("\n✅ DB smoke test passed.");
}

main().catch((err) => {
  console.error("\n✗ smoke test failed:", err);
  process.exit(1);
});
