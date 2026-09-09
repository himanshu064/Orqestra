import { CircleCheck, CircleX, Loader2 } from "lucide-react";
import { cn } from "cn";

export type IconStatus = "success" | "error" | "running";

/** Shared success/error/running indicator (check / x / spinner) used across run + trace views. */
export function StatusIcon({ status, className }: { status: IconStatus; className?: string }) {
  if (status === "error")
    return <CircleX className={cn("text-rose-500", className)} aria-label="error" />;
  if (status === "running")
    return <Loader2 className={cn("text-muted-foreground animate-spin", className)} aria-label="running" />;
  return <CircleCheck className={cn("text-emerald-500", className)} aria-label="success" />;
}
