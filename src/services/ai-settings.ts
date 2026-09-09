import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { aiSettings } from "@/db/schema";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import type { ProviderId } from "@/ai/models";

/** Safe-to-expose view of a org's AI settings (never includes the raw key). */
export type PublicAiSettings = {
  provider: ProviderId | null;
  model: string | null;
  embeddingModel: string | null;
  apiKeyLast4: string | null;
  hasKey: boolean;
  /** Dedicated embeddings provider + key (used when the chat provider has no embeddings API). */
  embeddingProvider: ProviderId | null;
  embeddingApiKeyLast4: string | null;
  hasEmbeddingKey: boolean;
};

export async function getAiSettings(orgId: string): Promise<PublicAiSettings> {
  const [row] = await db
    .select()
    .from(aiSettings)
    .where(eq(aiSettings.organizationId, orgId))
    .limit(1);

  return {
    provider: (row?.provider as ProviderId | undefined) ?? null,
    model: row?.model ?? null,
    embeddingModel: row?.embeddingModel ?? null,
    apiKeyLast4: row?.apiKeyLast4 ?? null,
    hasKey: Boolean(row?.apiKeyCiphertext),
    embeddingProvider: (row?.embeddingProvider as ProviderId | undefined) ?? null,
    embeddingApiKeyLast4: row?.embeddingApiKeyLast4 ?? null,
    hasEmbeddingKey: Boolean(row?.embeddingApiKeyCiphertext),
  };
}

export type SaveAiSettingsInput = {
  provider: ProviderId;
  model: string;
  embeddingModel?: string | null;
  /** When present and non-empty, the key is (re)encrypted; blank keeps the existing key. */
  apiKey?: string | null;
  /** Dedicated embeddings provider (null clears it → embeddings reuse the chat provider). */
  embeddingProvider?: ProviderId | null;
  /** When present and non-empty, the embeddings key is (re)encrypted; blank keeps the existing one. */
  embeddingApiKey?: string | null;
};

export async function saveAiSettings(
  orgId: string,
  userId: string,
  input: SaveAiSettingsInput,
): Promise<void> {
  const set: Partial<typeof aiSettings.$inferInsert> = {
    provider: input.provider,
    model: input.model,
    embeddingModel: input.embeddingModel ?? null,
    embeddingProvider: input.embeddingProvider ?? null,
    updatedByUserId: userId,
    updatedAt: new Date(),
  };

  const newKey = input.apiKey?.trim();
  if (newKey) {
    set.apiKeyCiphertext = encryptSecret(newKey);
    set.apiKeyLast4 = newKey.slice(-4);
  }

  const newEmbeddingKey = input.embeddingApiKey?.trim();
  if (newEmbeddingKey) {
    set.embeddingApiKeyCiphertext = encryptSecret(newEmbeddingKey);
    set.embeddingApiKeyLast4 = newEmbeddingKey.slice(-4);
  }

  await db
    .insert(aiSettings)
    .values({ organizationId: orgId, ...set })
    .onConflictDoUpdate({ target: aiSettings.organizationId, set });
}

/** Server-only: returns the decrypted API key for provider calls. Never send to the client. */
export async function getDecryptedApiKey(orgId: string): Promise<string | null> {
  const [row] = await db
    .select({ ciphertext: aiSettings.apiKeyCiphertext })
    .from(aiSettings)
    .where(eq(aiSettings.organizationId, orgId))
    .limit(1);

  if (!row?.ciphertext) return null;
  return decryptSecret(row.ciphertext);
}

/** Server-only: decrypted dedicated embeddings key, if one is configured. */
export async function getDecryptedEmbeddingKey(orgId: string): Promise<string | null> {
  const [row] = await db
    .select({ ciphertext: aiSettings.embeddingApiKeyCiphertext })
    .from(aiSettings)
    .where(eq(aiSettings.organizationId, orgId))
    .limit(1);

  if (!row?.ciphertext) return null;
  return decryptSecret(row.ciphertext);
}
