import { defineConfig } from "drizzle-kit";
import "dotenv/config";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set (needed by drizzle-kit).");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: { url },
  casing: "snake_case",
  strict: true,
  verbose: true,
});
