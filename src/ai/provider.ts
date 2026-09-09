import "server-only";

import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { EmbeddingModel, LanguageModel } from "ai";

import {
  getAiSettings,
  getDecryptedApiKey,
  getDecryptedEmbeddingKey,
} from "@/services/ai-settings";

import { defaultChatModel, defaultEmbeddingModel, type ProviderId } from "./models";

/** Thrown when no provider/key is configured; agents surface this as a "configure Settings" message. */
export class AiNotConfiguredError extends Error {
  constructor(message = "No AI provider is configured. Add an API key in Settings.") {
    super(message);
    this.name = "AiNotConfiguredError";
  }
}

async function resolveConfig(orgId: string): Promise<{
  provider: ProviderId;
  apiKey: string;
  model: string | null;
  embeddingModel: string | null;
}> {
  const settings = await getAiSettings(orgId);
  const apiKey = await getDecryptedApiKey(orgId);
  if (!settings.provider || !apiKey) throw new AiNotConfiguredError();
  return {
    provider: settings.provider,
    apiKey,
    model: settings.model,
    embeddingModel: settings.embeddingModel,
  };
}

/**
 * Build a Vercel AI SDK chat model from the org's stored provider + key.
 * The single entry point every agent (Phase 6+) uses  provider stays abstract.
 */
export async function resolveModel(orgId: string): Promise<LanguageModel> {
  const cfg = await resolveConfig(orgId);
  const modelId = cfg.model || defaultChatModel(cfg.provider);

  switch (cfg.provider) {
    case "openai":
      return createOpenAI({ apiKey: cfg.apiKey })(modelId);
    case "anthropic":
      return createAnthropic({ apiKey: cfg.apiKey })(modelId);
    case "google":
      return createGoogleGenerativeAI({ apiKey: cfg.apiKey })(modelId);
  }
}

/** The chat model id the org is configured to use (for cost tracking + display, §40). */
export async function resolveModelId(orgId: string): Promise<string> {
  const cfg = await resolveConfig(orgId);
  return cfg.model || defaultChatModel(cfg.provider);
}

/**
 * Resolve the embeddings provider/key/model. Prefers a dedicated embeddings provider (required when
 * the chat provider is Anthropic, which has no embeddings API); otherwise reuses the chat config.
 */
async function resolveEmbeddingConfig(
  orgId: string,
): Promise<{ provider: ProviderId; apiKey: string; model: string }> {
  const settings = await getAiSettings(orgId);

  if (settings.embeddingProvider) {
    // A dedicated embeddings key, or the shared chat key if it's the same provider.
    const apiKey =
      (await getDecryptedEmbeddingKey(orgId)) ??
      (settings.embeddingProvider === settings.provider ? await getDecryptedApiKey(orgId) : null);
    if (!apiKey) {
      throw new AiNotConfiguredError(
        "Add an embeddings API key in Settings for the selected embeddings provider.",
      );
    }
    const model = settings.embeddingModel || defaultEmbeddingModel(settings.embeddingProvider);
    if (!model) throw new AiNotConfiguredError("No embeddings model is configured.");
    return { provider: settings.embeddingProvider, apiKey, model };
  }

  // Fall back to the chat provider (works for OpenAI/Google; Anthropic needs a dedicated key).
  const cfg = await resolveConfig(orgId);
  if (cfg.provider === "anthropic") {
    throw new AiNotConfiguredError(
      "Claude has no embeddings API. Add an OpenAI or Google embeddings key in Settings to enable the Knowledge Base.",
    );
  }
  const model = cfg.embeddingModel || defaultEmbeddingModel(cfg.provider);
  if (!model) throw new AiNotConfiguredError("No embeddings model is configured.");
  return { provider: cfg.provider, apiKey: cfg.apiKey, model };
}

/** Build a text-embedding model (Phase 9 RAG). Anthropic has no first-party embeddings. */
export async function resolveEmbeddingModel(orgId: string): Promise<EmbeddingModel> {
  const { provider, apiKey, model } = await resolveEmbeddingConfig(orgId);

  switch (provider) {
    case "openai":
      return createOpenAI({ apiKey }).textEmbedding(model);
    case "google":
      return createGoogleGenerativeAI({ apiKey }).textEmbedding(model);
    case "anthropic":
      throw new AiNotConfiguredError(
        "Anthropic has no embeddings API. Configure OpenAI or Google for knowledge-base search.",
      );
  }
}
