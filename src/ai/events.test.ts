import { describe, expect, test } from "vitest";

import { events, toSseFrame } from "./events";

describe("event factories", () => {
  test("runStarted carries type + fields + timestamp", () => {
    const e = events.runStarted("r1", "objective text");
    expect(e).toMatchObject({ type: "run.started", runId: "r1", objective: "objective text" });
    expect(typeof e.at).toBe("string");
  });

  test("toolCompleted carries agent, tool, status, duration", () => {
    const e = events.toolCompleted("r1", "data_analyst", "getCustomers", "success", 12, {
      total: 5,
    });
    expect(e).toMatchObject({
      type: "tool.completed",
      agent: "data_analyst",
      tool: "getCustomers",
      status: "success",
      durationMs: 12,
    });
  });

  test("runCompleted carries totals", () => {
    const e = events.runCompleted("r1", { ok: true }, { steps: 2, toolCalls: 3 });
    expect(e).toMatchObject({ type: "run.completed", totals: { steps: 2, toolCalls: 3 } });
  });
});

describe("toSseFrame", () => {
  test("formats a valid SSE data frame", () => {
    const frame = toSseFrame(events.runFailed("r1", "boom"));
    expect(frame.startsWith("data: ")).toBe(true);
    expect(frame.endsWith("\n\n")).toBe(true);
    expect(JSON.parse(frame.slice(6).trim())).toMatchObject({ type: "run.failed", error: "boom" });
  });
});
