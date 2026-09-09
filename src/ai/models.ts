/** Provider catalog for the BYO-key Settings flow (requirements §7, §48). */

export type ProviderId = "anthropic" | "openai" | "google";

export const AI_PROVIDERS: { value: ProviderId; label: string }[] = [
  { value: "anthropic", label: "Anthropic (Claude)" },
  { value: "openai", label: "OpenAI" },
  { value: "google", label: "Google (Gemini)" },
];

/** Providers that offer a first-party embeddings API (Anthropic does not). */
export const EMBEDDING_PROVIDERS: { value: ProviderId; label: string }[] = [
  { value: "google", label: "Google (Gemini)" },
  { value: "openai", label: "OpenAI" },
];

type ProviderCatalog = {
  chat: string;
  /** null when the provider has no first-party embeddings (Anthropic). */
  embedding: string | null;
  chatSuggestions: string[];
  keyHint: string;
};

/**
 * Defaults + suggestions per provider. Model IDs are free-text in the UI (catalogs churn),
 * so these are starting points, not a closed enum.
 */
export const PROVIDER_CATALOG: Record<ProviderId, ProviderCatalog> = {
  anthropic: {
    chat: "claude-sonnet-5",
    embedding: null, // Anthropic has no first-party embeddings  RAG uses OpenAI/Google (Phase 9)
    chatSuggestions: ["claude-opus-4-8", "claude-sonnet-5", "claude-haiku-4-5"],
    keyHint: "Anthropic API key (starts with sk-ant-)",
  },
  openai: {
    chat: "gpt-4o",
    embedding: "text-embedding-3-small",
    chatSuggestions: ["gpt-4o", "gpt-4o-mini", "gpt-4.1"],
    keyHint: "OpenAI API key (starts with sk-)",
  },
  google: {
    chat: "gemini-3.6-flash",
    embedding: "gemini-embedding-001", // configured to 1536 dims via outputDimensionality
    chatSuggestions: ["gemini-3.6-flash", "gemini-3.6-pro", "gemini-2.5-flash"],
    keyHint: "Google AI Studio API key",
  },
};

export function defaultChatModel(provider: ProviderId): string {
  return PROVIDER_CATALOG[provider].chat;
}

export function defaultEmbeddingModel(provider: ProviderId): string | null {
  return PROVIDER_CATALOG[provider].embedding;
}
