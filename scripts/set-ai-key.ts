import "dotenv/config";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { organizations, users } from "@/db/schema";
import { saveAiSettings } from "@/services/ai-settings";
import type { ProviderId } from "@/ai/models";

/**
 * Bridge: provision the demo org's encrypted `ai_settings` row from an env var, so the
 * BYO-key path (Settings → resolveModel) works without using the UI. Reads AI_API_KEY plus
 * optional AI_PROVIDER (default google), AI_MODEL (default gemini-2.0-flash).
 */
async function main() {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) throw new Error("AI_API_KEY is not set in .env");

  const provider = (process.env.AI_PROVIDER ?? "google") as ProviderId;
  const model =
    process.env.AI_MODEL ??
    (provider === "google"
      ? "gemini-3.6-flash"
      : provider === "openai"
        ? "gpt-4o"
        : "claude-sonnet-5");
  const embeddingModel =
    process.env.AI_EMBEDDING_MODEL ??
    (provider === "google"
      ? "gemini-embedding-001"
      : provider === "openai"
        ? "text-embedding-3-small"
        : null);

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, "orqestra-demo"))
    .limit(1);
  if (!org) throw new Error("Demo org not found  run `npm run db:seed` first.");

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, "manager@orqestra.demo"))
    .limit(1);

  await saveAiSettings(org.id, user!.id, { provider, model, embeddingModel, apiKey });

  console.log(
    `✓ ai_settings provisioned for demo org: provider=${provider}, model=${model} (key ****${apiKey.slice(-4)})`,
  );
}

main().catch((err) => {
  console.error("✗ set-ai-key failed:", err);
  process.exit(1);
});
