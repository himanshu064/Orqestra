import { AGENT_META } from "@/config/agents";
import type { AgentSuccessRate } from "@/services/analytics";
import type { AgentKey } from "@/ai/tools/registry";

function barColor(rate: number): string {
  if (rate >= 90) return "bg-emerald-500";
  if (rate >= 70) return "bg-sky-500";
  if (rate >= 40) return "bg-amber-500";
  return "bg-rose-500";
}

export function AgentPerformance({ rates }: { rates: AgentSuccessRate[] }) {
  if (rates.length === 0) {
    return <p className="text-muted-foreground text-sm">No agent activity yet.</p>;
  }
  return (
    <ul className="space-y-4">
      {rates.map((r) => {
        const meta = AGENT_META[r.agent as AgentKey];
        const Icon = meta?.icon;
        return (
          <li key={r.agent} className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="inline-flex items-center gap-2">
                {Icon ? <Icon className="text-muted-foreground size-4" /> : null}
                <span className="font-medium">{meta?.short ?? r.agent}</span>
              </span>
              <span className="text-muted-foreground text-xs tabular-nums">
                {r.rate}% · {r.success}/{r.total}
              </span>
            </div>
            <div className="bg-muted h-1.5 overflow-hidden rounded-full">
              <div
                className={`h-full rounded-full ${barColor(r.rate)}`}
                style={{ width: `${Math.max(3, r.rate)}%` }}
                role="progressbar"
                aria-valuenow={r.rate}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
