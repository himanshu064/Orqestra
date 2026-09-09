import type { AgentEvent } from "@/ai/events";

/** Split a growing buffer into complete SSE frames (separated by \n\n) and the remainder. */
export function splitSseFrames(buffer: string): { frames: string[]; rest: string } {
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  return { frames: parts.filter((p) => p.trim().length > 0), rest };
}

/** Parse an SSE frame's `data:` line into an AgentEvent (null if unparseable). */
export function parseEventFrame(frame: string): AgentEvent | null {
  const line = frame.split("\n").find((l) => l.startsWith("data:"));
  if (!line) return null;
  try {
    return JSON.parse(line.slice(5).trim()) as AgentEvent;
  } catch {
    return null;
  }
}
