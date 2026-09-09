import { pgTable, text, uuid } from "drizzle-orm/pg-core";

import { aiProvider } from "./_enums";
import { createdAt, pk, updatedAt } from "./_helpers";
import { organizations, users } from "./organizations";

/**
 * Bring-Your-Own LLM provider configuration (populated by the Phase 4 Settings flow).
 * The API key is stored ENCRYPTED (`api_key_ciphertext`); `api_key_last4` is for masked
 * display only. The raw key is never persisted or returned to the browser (§55).
 */
export const aiSettings = pgTable("ai_settings", {
  id: pk(),
  organizationId: uuid("organization_id")
    .notNull()
    .unique()
    .references(() => organizations.id, { onDelete: "cascade" }),
  provider: aiProvider("provider"),
  model: text("model"),
  embeddingModel: text("embedding_model"),
  apiKeyCiphertext: text("api_key_ciphertext"),
  apiKeyLast4: text("api_key_last4"),
  /**
   * Optional dedicated embeddings provider + key. Needed when `provider` is Anthropic (Claude has
   * no embeddings API), so RAG can fall back to OpenAI/Google. When null, embeddings reuse the
   * chat provider + key above.
   */
  embeddingProvider: aiProvider("embedding_provider"),
  embeddingApiKeyCiphertext: text("embedding_api_key_ciphertext"),
  embeddingApiKeyLast4: text("embedding_api_key_last4"),
  updatedByUserId: uuid("updated_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});
