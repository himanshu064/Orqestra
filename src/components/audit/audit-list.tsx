import { Ban, Check, Cog, ShieldCheck, User, type LucideIcon } from "lucide-react";

import type { AuditEntry } from "@/services/audit";
import { Card, CardContent } from "@/components/ui/card";
import { Tag, TONE_CLASS, type TagTone } from "@/components/ui/tag";
import { cn } from "cn";
import { relativeTime } from "@/lib/format";

type Tone = Extract<TagTone, "emerald" | "rose" | "neutral">;

function tone(result: string | null): Tone {
  if (!result) return "neutral";
  const r = result.toLowerCase();
  if (r.includes("success") || r === "ok" || r.includes("executed")) return "emerald";
  if (r.includes("fail") || r.includes("error") || r.includes("reject")) return "rose";
  return "neutral";
}

function iconFor(entry: AuditEntry, t: Tone): LucideIcon {
  const a = entry.action.toLowerCase();
  if (a.includes("reject") || t === "rose") return Ban;
  if (a.includes("execut") || a.includes("approv") || t === "emerald") return Check;
  if (entry.actorType === "user") return User;
  if (entry.actorType === "system") return Cog;
  return ShieldCheck;
}

/** "approval.executed" → "Approval executed" */
function humanizeAction(action: string): string {
  const s = action.replace(/[._]/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function AuditList({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-8 text-center text-sm">
          No audit entries yet. Approving or rejecting a sensitive action records an immutable entry
          here.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="py-2">
      <CardContent className="divide-border/50 divide-y px-2">
        {entries.map((e) => {
          const t = tone(e.result);
          const Icon = iconFor(e, t);
          return (
            <div key={e.id} className="flex items-center gap-3 px-2 py-3">
              <span
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-full",
                  TONE_CLASS[t],
                )}
              >
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">{humanizeAction(e.action)}</span>
                  {e.targetType ? (
                    <span className="text-muted-foreground bg-muted rounded px-1.5 py-0.5 font-mono text-[11px]">
                      {e.targetType}
                      {e.targetId ? `·${e.targetId.slice(0, 8)}` : ""}
                    </span>
                  ) : null}
                </div>
                <div className="text-muted-foreground mt-0.5 text-xs">
                  {e.actorLabel} · {relativeTime(e.createdAt)}
                </div>
              </div>
              {e.result ? <Tag tone={t}>{e.result}</Tag> : null}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
