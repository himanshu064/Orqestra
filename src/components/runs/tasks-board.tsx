"use client";

import { useState } from "react";
import { cn } from "cn";

import type { RunSummary } from "@/services/runs";
import { Card, CardContent } from "@/components/ui/card";
import { TaskCard } from "./task-card";

type FilterKey = "all" | "completed" | "failed" | "active";

const TERMINAL = new Set(["completed", "failed", "cancelled"]);

function matches(filter: FilterKey, status: string): boolean {
  if (filter === "all") return true;
  if (filter === "completed") return status === "completed";
  if (filter === "failed") return status === "failed" || status === "cancelled";
  return !TERMINAL.has(status); // active / in-progress
}

export function TasksBoard({ runs }: { runs: RunSummary[] }) {
  const [filter, setFilter] = useState<FilterKey>("all");

  const counts = {
    all: runs.length,
    completed: runs.filter((r) => r.status === "completed").length,
    failed: runs.filter((r) => r.status === "failed" || r.status === "cancelled").length,
    active: runs.filter((r) => !TERMINAL.has(r.status)).length,
  };

  const chips: { key: FilterKey; label: string }[] = [
    { key: "all", label: "All" },
    { key: "active", label: "In progress" },
    { key: "completed", label: "Completed" },
    { key: "failed", label: "Failed" },
  ];

  const visible = runs.filter((r) => matches(filter, r.status));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {chips.map((c) => {
          const active = filter === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setFilter(c.key)}
              disabled={counts[c.key] === 0 && c.key !== "all"}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-40",
                active
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {c.label}
              <span
                className={cn(
                  "tabular-nums",
                  active ? "text-background/70" : "text-muted-foreground/70",
                )}
              >
                {counts[c.key]}
              </span>
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground text-sm">
            No {filter === "all" ? "" : filter} tasks to show.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((r) => (
            <TaskCard key={r.id} run={r} />
          ))}
        </div>
      )}
    </div>
  );
}
