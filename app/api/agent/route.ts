import { z } from "zod";

import { getCurrentUser } from "@/auth/dal";
import { toSseFrame, type AgentEvent } from "@/ai/events";
import { json } from "@/lib/http";
import { acquireRunSlot, releaseRunSlot } from "@/lib/rate-limit";
import { executeAgentRun } from "@/services/agent-runner";

export const runtime = "nodejs";
// A real Manager → specialist run can stream well past 60s; allow serverless headroom
// (Vercel Pro caps at 300; Hobby is capped at 60). Appendix A.2.
export const maxDuration = 300;

const MAX_OBJECTIVE_CHARS = 4000;
const bodySchema = z.object({ message: z.string().trim().min(1).max(MAX_OBJECTIVE_CHARS) });

export async function POST(req: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return json({ error: "Unauthorized" }, 401);

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return json({ error: `message is required (1–${MAX_OBJECTIVE_CHARS} characters).` }, 400);
  }
  const message = parsed.data.message;

  // Per-org concurrency cap  reject rather than pile up unbounded parallel runs (cost/DoS).
  if (!acquireRunSlot(user.organizationId)) {
    return json({ error: "Too many concurrent runs. Please wait for one to finish." }, 429);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const emit = (event: AgentEvent) => {
        try {
          controller.enqueue(encoder.encode(toSseFrame(event)));
        } catch {
          // stream already closed
        }
      };

      executeAgentRun({
        organizationId: user.organizationId,
        userId: user.id,
        objective: message,
        emit,
      })
        .catch((err) => {
          console.error("[agent] run failed", err);
          emit({
            type: "run.failed",
            runId: "",
            at: new Date().toISOString(),
            error: "The run could not be completed. Please try again.",
          });
        })
        .finally(() => {
          releaseRunSlot(user.organizationId);
          try {
            controller.close();
          } catch {
            // already closed
          }
        });
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
