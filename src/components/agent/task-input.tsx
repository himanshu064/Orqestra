"use client";

import { CornerDownLeft, Sparkles } from "lucide-react";
import { useState } from "react";

import { TEMPLATES } from "@/config/scenarios";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export function TaskInput({
  onSubmit,
  disabled,
  initialText = "",
}: {
  onSubmit: (message: string) => void;
  disabled?: boolean;
  initialText?: string;
}) {
  const [text, setText] = useState(initialText);

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
  };

  return (
    <div className="space-y-3">
      <Card className="focus-within:ring-ring/50 gap-0 overflow-hidden py-0 transition-shadow focus-within:ring-2">
        <div className="flex items-center gap-2 px-4 pt-3.5 pb-1">
          <Sparkles className="text-muted-foreground size-4" />
          <label htmlFor="objective" className="text-sm font-medium">
            What would you like your AI team to accomplish?
          </label>
        </div>

        <Textarea
          id="objective"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Analyze our customers and identify high-value accounts at risk of churn…"
          rows={3}
          disabled={disabled}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
          }}
          className="max-h-56 min-h-20 resize-none border-0 bg-transparent px-4 py-2 shadow-none focus-visible:ring-0 dark:bg-transparent"
        />

        <div className="border-border/60 flex items-center justify-between gap-3 border-t px-3 py-2.5">
          <span className="text-muted-foreground hidden items-center gap-1.5 text-xs sm:flex">
            <kbd className="bg-muted rounded px-1.5 py-0.5 font-sans text-[10px] font-medium">
              ⌘ / Ctrl
            </kbd>
            <span>+</span>
            <kbd className="bg-muted inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 font-sans text-[10px] font-medium">
              <CornerDownLeft className="size-2.5" /> Enter
            </kbd>
            <span>to run</span>
          </span>
          <Button onClick={submit} disabled={disabled || !text.trim()} className="ml-auto">
            <Sparkles className="size-4" />
            {disabled ? "Running…" : "Run"}
          </Button>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground mr-1 text-xs font-medium">Templates</span>
        {TEMPLATES.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              disabled={disabled}
              onClick={() => setText(t.objective)}
              title={t.description}
              className="group border-border text-foreground/80 hover:border-foreground/20 hover:bg-muted inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
            >
              <Icon className="text-muted-foreground group-hover:text-foreground size-3.5 transition-colors" />
              {t.title}
            </button>
          );
        })}
      </div>
    </div>
  );
}
