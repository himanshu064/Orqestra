"use client";

import { ChevronDown, Wrench } from "lucide-react";
import { useState } from "react";

import { AGENT_META } from "@/config/agents";
import type { AgentKey } from "@/ai/tools/registry";
import { Card, CardContent } from "@/components/ui/card";
import { StatusIcon } from "@/components/ui/status-icon";
import { Tag, type TagTone } from "@/components/ui/tag";
import { cn } from "cn";
import { formatDuration } from "@/lib/format";

export type TraceStep = {
  id: string;
  agent: string;
  type: string;
  title: string | null;
  status: string;
  output: unknown;
};

export type TraceCall = {
  id: string;
  stepId: string | null;
  agent: string;
  tool: string;
  input: unknown;
  output: unknown;
  status: string;
  durationMs: number | null;
};

function StatusDot({ status, className }: { status: string; className?: string }) {
  return <StatusIcon status={status === "error" ? "error" : "success"} className={className} />;
}

const TYPE_TONE: Record<string, TagTone> = {
  plan: "violet",
  delegate: "sky",
  tool_call: "neutral",
  review: "amber",
  final: "emerald",
  message: "neutral",
};

function TypeBadge({ type }: { type: string }) {
  return <Tag tone={TYPE_TONE[type] ?? "neutral"}>{type}</Tag>;
}

function Json({ value }: { value: unknown }) {
  if (value == null) return <span className="text-muted-foreground"></span>;
  return (
    <pre className="bg-muted/60 text-muted-foreground max-h-64 overflow-auto rounded-md p-2 text-xs">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function ToolCallRow({ call }: { call: TraceCall }) {
  const [open, setOpen] = useState(false);
  const meta = AGENT_META[call.agent as AgentKey];
  return (
    <li className="border-border/60 bg-background/40 rounded-lg border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="hover:bg-muted/50 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left"
        aria-expanded={open}
      >
        <Wrench className="text-muted-foreground size-3.5 shrink-0" />
        <code className="text-sm font-medium">{call.tool}</code>
        <span className="text-muted-foreground hidden text-xs sm:inline">
          {meta?.short ?? call.agent}
        </span>
        <span className="ml-auto flex items-center gap-2">
          <span className="text-muted-foreground text-xs tabular-nums">
            {formatDuration(call.durationMs)}
          </span>
          <StatusDot status={call.status} className="size-4 shrink-0" />
          <ChevronDown
            className={cn("text-muted-foreground size-4 transition-transform", open && "rotate-180")}
          />
        </span>
      </button>
      {open ? (
        <div className="space-y-3 px-3 pb-3">
          <div className="space-y-1">
            <div className="text-muted-foreground text-xs font-semibold uppercase">Input</div>
            <Json value={call.input} />
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground text-xs font-semibold uppercase">Output</div>
            <Json value={call.output} />
          </div>
        </div>
      ) : null}
    </li>
  );
}

function StepNode({ index, status }: { index: number; status: string }) {
  const error = status === "error";
  return (
    <div
      className={cn(
        "bg-background relative z-10 grid size-8 shrink-0 place-items-center rounded-full border-2 text-xs font-semibold tabular-nums",
        error ? "border-rose-500/50 text-rose-500" : "border-emerald-500/50 text-emerald-500",
      )}
    >
      {index}
    </div>
  );
}

function StepItem({
  step,
  index,
  calls,
}: {
  step: TraceStep;
  index: number;
  calls: TraceCall[];
}) {
  const meta = AGENT_META[step.agent as AgentKey];
  const Icon = meta?.icon;
  return (
    <li className="relative flex gap-4">
      <StepNode index={index} status={step.status} />
      <Card className="flex-1">
        <CardContent className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {Icon ? <Icon className="text-muted-foreground size-4" /> : null}
                <span className="text-sm font-medium">{step.title ?? step.type}</span>
                <TypeBadge type={step.type} />
              </div>
              <div className="text-muted-foreground mt-0.5 text-xs">{meta?.short ?? step.agent}</div>
            </div>
            <StatusDot status={step.status} className="mt-0.5 size-4 shrink-0" />
          </div>

          {calls.length ? (
            <ul className="space-y-2">
              {calls.map((c) => (
                <ToolCallRow key={c.id} call={c} />
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>
    </li>
  );
}

export function TraceView({ steps, calls }: { steps: TraceStep[]; calls: TraceCall[] }) {
  const callsByStep = new Map<string, TraceCall[]>();
  const orphanCalls: TraceCall[] = [];
  for (const c of calls) {
    if (c.stepId && steps.some((s) => s.id === c.stepId)) {
      const arr = callsByStep.get(c.stepId) ?? [];
      arr.push(c);
      callsByStep.set(c.stepId, arr);
    } else {
      orphanCalls.push(c);
    }
  }

  return (
    <ol className="relative space-y-4">
      {/* timeline spine */}
      <div className="bg-border absolute top-4 bottom-4 left-4 w-px -translate-x-1/2" aria-hidden />

      {steps.map((step, i) => (
        <StepItem key={step.id} step={step} index={i + 1} calls={callsByStep.get(step.id) ?? []} />
      ))}

      {orphanCalls.length ? (
        <li className="relative flex gap-4">
          <div className="bg-muted text-muted-foreground relative z-10 grid size-8 shrink-0 place-items-center rounded-full border-2">
            <Wrench className="size-3.5" />
          </div>
          <Card className="flex-1">
            <CardContent className="space-y-2">
              <div className="text-muted-foreground text-xs font-semibold uppercase">
                Other tool calls
              </div>
              <ul className="space-y-2">
                {orphanCalls.map((c) => (
                  <ToolCallRow key={c.id} call={c} />
                ))}
              </ul>
            </CardContent>
          </Card>
        </li>
      ) : null}
    </ol>
  );
}
