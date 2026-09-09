import type { ReactNode } from "react";
import { cn } from "cn";

/**
 * Small pill/label used across the app for statuses, types, and results.
 * String content is rendered with its first character upper-cased (e.g. "tool_call" → "Tool_call",
 * "success" → "Success") so raw enum values read as labels.
 */

/**
 * Single source of truth for tone → color classes (tinted bg + text, light/dark). Reused by KPI
 * cards, audit nodes, and the dashboard so the palette is defined exactly once.
 */
export const TONE_CLASS = {
  neutral: "bg-muted text-muted-foreground",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  sky: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  outline: "border-border text-foreground border",
} as const;

export type TagTone = keyof typeof TONE_CLASS;

export function capitalizeFirst(value: string): string {
  return value.length ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

export function Tag({
  children,
  tone = "neutral",
  mono = false,
  uppercaseFirst = true,
  className,
}: {
  children: ReactNode;
  tone?: TagTone;
  /** Render in a monospace font (for ids / model names). */
  mono?: boolean;
  /** Upper-case the first character of string content (default true). */
  uppercaseFirst?: boolean;
  className?: string;
}) {
  const content =
    uppercaseFirst && typeof children === "string" ? capitalizeFirst(children) : children;
  return (
    <span
      className={cn(
        "inline-flex h-5 w-fit shrink-0 items-center gap-1 rounded-full px-2 text-[11px] font-medium whitespace-nowrap",
        TONE_CLASS[tone],
        mono && "font-mono",
        className,
      )}
    >
      {content}
    </span>
  );
}
