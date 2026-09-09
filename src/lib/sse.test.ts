import { describe, expect, test } from "vitest";

import { parseEventFrame, splitSseFrames } from "./sse";

describe("splitSseFrames", () => {
  test("splits complete frames and keeps the remainder", () => {
    const { frames, rest } = splitSseFrames('data: {"a":1}\n\ndata: {"b":2}\n\ndata: partial');
    expect(frames).toEqual(['data: {"a":1}', 'data: {"b":2}']);
    expect(rest).toBe("data: partial");
  });

  test("a frame spanning two chunks is completed on the second chunk", () => {
    let buffer = 'data: {"type":"run.st';
    let out = splitSseFrames(buffer);
    expect(out.frames).toEqual([]);
    buffer = out.rest + 'arted","runId":"r1"}\n\n';
    out = splitSseFrames(buffer);
    expect(out.frames).toEqual(['data: {"type":"run.started","runId":"r1"}']);
    expect(out.rest).toBe("");
  });
});

describe("parseEventFrame", () => {
  test("parses the data line into an event", () => {
    const e = parseEventFrame('data: {"type":"run.started","runId":"r1","at":"t","objective":"x"}');
    expect(e).toMatchObject({ type: "run.started", runId: "r1" });
  });

  test("returns null for malformed json", () => {
    expect(parseEventFrame("data: {not json")).toBeNull();
    expect(parseEventFrame("event: ping")).toBeNull();
  });
});
