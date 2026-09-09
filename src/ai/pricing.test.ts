import { describe, expect, test } from "vitest";

import { FALLBACK_PRICE, MODEL_PRICING, priceFor } from "@/ai/pricing";
import { estimateCostCents, formatUsd } from "@/lib/cost";

describe("model pricing", () => {
  test("exact ids resolve to their listed price", () => {
    expect(priceFor("claude-opus-4-8")).toEqual({ inputPerMTok: 5, outputPerMTok: 25 });
    expect(priceFor("gpt-4o-mini")).toEqual(MODEL_PRICING["gpt-4o-mini"]);
    expect(priceFor("gemini-3.6-flash")).toEqual({ inputPerMTok: 0.3, outputPerMTok: 2.5 });
  });

  test("dated / unknown variants fall back to the family prefix", () => {
    expect(priceFor("claude-sonnet-5-20260101")).toEqual({ inputPerMTok: 3, outputPerMTok: 15 });
    expect(priceFor("gemini-9.9-flash-preview")).toEqual({ inputPerMTok: 0.3, outputPerMTok: 2.5 });
  });

  test("unrecognized model → nominal fallback", () => {
    expect(priceFor("some-unknown-model")).toEqual(FALLBACK_PRICE);
    expect(priceFor(null)).toEqual(FALLBACK_PRICE);
  });
});

describe("estimateCostCents", () => {
  test("model-aware overload uses per-model pricing", () => {
    // 1M input @ $5 + 1M output @ $25 = $30 = 3000 cents
    expect(estimateCostCents("claude-opus-4-8", 1_000_000, 1_000_000)).toBe(3000);
  });

  test("2-arg overload uses the nominal fallback", () => {
    // 1M input @ $0.30 + 1M output @ $2.50 = $2.80 = 280 cents
    expect(estimateCostCents(1_000_000, 1_000_000)).toBe(280);
  });

  test("null model falls back to nominal", () => {
    expect(estimateCostCents(null, 1_000_000, 1_000_000)).toBe(280);
  });

  test("formatUsd renders cents as dollars", () => {
    expect(formatUsd(3000)).toBe("$30.00");
    expect(formatUsd(5)).toBe("$0.05");
  });
});
