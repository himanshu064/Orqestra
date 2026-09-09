import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import { env } from "@/env";

import * as schema from "./schema";

const databaseUrl = env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set.");
}

// Neon HTTP driver: each query is an autocommit HTTP request  serverless-optimal for
// Vercel and safe over the pooled endpoint. Add the WebSocket Pool driver later only if
// a feature needs interactive transactions.
const sql = neon(databaseUrl);

export const db = drizzle(sql, { schema, casing: "snake_case" });

export { schema };
