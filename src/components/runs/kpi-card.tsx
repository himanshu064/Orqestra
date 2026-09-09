import type { LucideIcon } from "lucide-react";
import { cn } from "cn";

import { Card, CardContent } from "@/components/ui/card";
import { TONE_CLASS, type TagTone } from "@/components/ui/tag";

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: TagTone;
}) {
  return (
    <Card className="ring-border hover:ring-foreground/20 transition-shadow hover:shadow-sm">
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {label}
          </span>
          {Icon ? (
            <span
              className={cn("grid size-8 shrink-0 place-items-center rounded-lg", TONE_CLASS[tone])}
            >
              <Icon className="size-4" />
            </span>
          ) : null}
        </div>
        <div className="space-y-0.5">
          <div className="text-3xl font-semibold tracking-tight tabular-nums">{value}</div>
          {hint ? <div className="text-muted-foreground text-xs">{hint}</div> : null}
        </div>
      </CardContent>
    </Card>
  );
}
