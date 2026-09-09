import { describe, expect, test } from "vitest";

import { chunkText } from "./chunk";

describe("chunkText", () => {
  test("empty text yields no chunks", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   \n\n  ")).toEqual([]);
  });

  test("short text yields a single chunk with index 0", () => {
    const c = chunkText("Hello world.");
    expect(c).toEqual([{ content: "Hello world.", index: 0 }]);
  });

  test("packs paragraphs and keeps each chunk within size", () => {
    const para = "A".repeat(400);
    const c = chunkText([para, para, para].join("\n\n"), { size: 900, overlap: 100 });
    expect(c.length).toBeGreaterThan(1);
    expect(c.every((x) => x.content.length <= 900)).toBe(true);
    expect(c.map((x) => x.index)).toEqual(c.map((_, i) => i));
  });

  test("hard-splits a paragraph longer than size", () => {
    const c = chunkText("B".repeat(2000), { size: 900, overlap: 150 });
    expect(c.length).toBeGreaterThanOrEqual(3);
    expect(c[0]!.content.length).toBe(900);
  });
});
