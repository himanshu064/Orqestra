import { FALLBACK_PRICE, priceFor, type ModelPrice } from "@/ai/pricing";

/**
 * Cost estimation (§40). Prefer the model-aware overload so displayed cost reflects the
 * configured model's real pricing; the 2-arg form keeps a nominal blended estimate for
 * older rows / callers that don't know the model.
 */

function costCents(price: ModelPrice, inputTokens: number, outputTokens: number): number {
  const dollars =
    (inputTokens / 1_000_000) * price.inputPerMTok +
    (outputTokens / 1_000_000) * price.outputPerMTok;
  return Math.round(dollars * 100);
}

/** Nominal estimate from token counts only (blended fallback rates). */
export function estimateCostCents(inputTokens: number, outputTokens: number): number;
/** Model-aware estimate using per-model pricing. */
export function estimateCostCents(model: string | null, inputTokens: number, outputTokens: number): number;
export function estimateCostCents(a: string | null | number, b: number, c?: number): number {
  if (typeof a === "number") {
    return costCents(FALLBACK_PRICE, a, b);
  }
  return costCents(priceFor(a), b, c ?? 0);
}

export function formatUsd(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
