import { describe, expect, test } from "vitest";

import { researchFindingsSchema } from "./research";

describe("researchFindingsSchema", () => {
  test("parses valid sourced findings", () => {
    const sample = {
      summary: "Enterprise refunds are prorated after 30 days.",
      findings: [
        "Full refund within 30 days of contract start.",
        "10% early-termination fee after.",
      ],
      possibleCauses: [],
      sources: [{ title: "Enterprise Refund Policy", locator: "Section 2" }],
    };
    expect(researchFindingsSchema.parse(sample)).toEqual(sample);
  });

  test("rejects missing sources array", () => {
    expect(() =>
      researchFindingsSchema.parse({ summary: "x", findings: [], possibleCauses: [] }),
    ).toThrow();
  });
});
