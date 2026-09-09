/**
 * Model pricing for cost estimation (§40). USD per 1M tokens.
 * V1 estimate based on published list prices; refined as catalogs change. Exact-id match first,
 * then a prefix/family heuristic, then a nominal fallback so unknown models still surface a number.
 */

export type ModelPrice = { inputPerMTok: number; outputPerMTok: number };

/** Nominal blended fallback used when a model id isn't recognized. */
export const FALLBACK_PRICE: ModelPrice = { inputPerMTok: 0.3, outputPerMTok: 2.5 };

/** Exact model-id → price. Keep ids matching the Settings catalog (`models.ts`). */
export const MODEL_PRICING: Record<string, ModelPrice> = {
  // Anthropic
  "claude-opus-4-8": { inputPerMTok: 5, outputPerMTok: 25 },
  "claude-opus-4-7": { inputPerMTok: 5, outputPerMTok: 25 },
  "claude-sonnet-5": { inputPerMTok: 3, outputPerMTok: 15 },
  "claude-sonnet-4-6": { inputPerMTok: 3, outputPerMTok: 15 },
  "claude-haiku-4-5": { inputPerMTok: 1, outputPerMTok: 5 },
  // OpenAI
  "gpt-4o": { inputPerMTok: 2.5, outputPerMTok: 10 },
  "gpt-4o-mini": { inputPerMTok: 0.15, outputPerMTok: 0.6 },
  "gpt-4.1": { inputPerMTok: 2, outputPerMTok: 8 },
  "gpt-4.1-mini": { inputPerMTok: 0.4, outputPerMTok: 1.6 },
  // Google (Gemini)  Flash-tier is the default chat model
  "gemini-3.6-flash": { inputPerMTok: 0.3, outputPerMTok: 2.5 },
  "gemini-3.6-pro": { inputPerMTok: 1.25, outputPerMTok: 10 },
  "gemini-2.5-flash": { inputPerMTok: 0.3, outputPerMTok: 2.5 },
  "gemini-2.5-pro": { inputPerMTok: 1.25, outputPerMTok: 10 },
};

/** Family prefixes for models not matched exactly (e.g. dated variants). */
const FAMILY_PREFIXES: { prefix: string; price: ModelPrice }[] = [
  { prefix: "claude-opus", price: { inputPerMTok: 5, outputPerMTok: 25 } },
  { prefix: "claude-sonnet", price: { inputPerMTok: 3, outputPerMTok: 15 } },
  { prefix: "claude-haiku", price: { inputPerMTok: 1, outputPerMTok: 5 } },
  { prefix: "gpt-4o-mini", price: { inputPerMTok: 0.15, outputPerMTok: 0.6 } },
  { prefix: "gpt-4o", price: { inputPerMTok: 2.5, outputPerMTok: 10 } },
  { prefix: "gpt-4.1", price: { inputPerMTok: 2, outputPerMTok: 8 } },
  { prefix: "gemini-3.6-pro", price: { inputPerMTok: 1.25, outputPerMTok: 10 } },
  { prefix: "gemini-2.5-pro", price: { inputPerMTok: 1.25, outputPerMTok: 10 } },
  { prefix: "gemini", price: { inputPerMTok: 0.3, outputPerMTok: 2.5 } },
];

/** Resolve a price for a model id (nullish → fallback). */
export function priceFor(model: string | null | undefined): ModelPrice {
  if (!model) return FALLBACK_PRICE;
  const exact = MODEL_PRICING[model];
  if (exact) return exact;
  const fam = FAMILY_PREFIXES.find((f) => model.startsWith(f.prefix));
  return fam?.price ?? FALLBACK_PRICE;
}
