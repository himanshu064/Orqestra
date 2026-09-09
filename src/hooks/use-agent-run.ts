"use client";

import { useCallback, useMemo, useState } from "react";

import type { AgentEvent } from "@/ai/events";
import { reduceActivity } from "@/lib/agent-activity";
import { parseEventFrame, splitSseFrames } from "@/lib/sse";

/**
 * Drives an agent run: POSTs the objective to /api/agent, reads the SSE stream, and folds the
 * events into activity state via the pure reducer.
 */
export function useAgentRun() {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [objective, setObjective] = useState<string | undefined>(undefined);
  const [isStreaming, setIsStreaming] = useState(false);

  const run = useCallback(async (message: string) => {
    setEvents([]);
    setObjective(message);
    setIsStreaming(true);

    const fail = (error: string) =>
      setEvents((prev) => [
        ...prev,
        { type: "run.failed", runId: "", at: new Date().toISOString(), error },
      ]);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message }),
      });

      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        fail(body.error ?? `Request failed (${res.status})`);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const { frames, rest } = splitSseFrames(buffer);
        buffer = rest;
        const parsed = frames.map(parseEventFrame).filter((e): e is AgentEvent => e !== null);
        if (parsed.length) setEvents((prev) => [...prev, ...parsed]);
      }
    } catch (err) {
      fail(err instanceof Error ? err.message : "Stream error");
    } finally {
      setIsStreaming(false);
    }
  }, []);

  const activity = useMemo(() => reduceActivity(events, objective), [events, objective]);

  return { run, activity, isStreaming };
}
