import type { ManagerReport } from "@/ai/agents/manager";
import type { ActivityState } from "@/lib/agent-activity";

const num = (n: number) => n.toLocaleString("en-US");
const usd = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

export function ReportView({
  report,
  totals,
}: {
  report: ManagerReport;
  totals?: ActivityState["totals"];
}) {
  const m = report.metrics;
  // Prefer the Manager's scenario-adaptive keyMetrics; fall back to the churn-centric metrics.
  const cards =
    report.keyMetrics && report.keyMetrics.length > 0
      ? report.keyMetrics.slice(0, 4).map((k) => ({ label: k.label, value: k.value }))
      : [
          { label: "Customers analyzed", value: num(m.customersAnalyzed) },
          { label: "High-risk", value: num(m.highRiskCustomers) },
          { label: "High-value at risk", value: num(m.highValueAtRisk) },
          { label: "Recovery opportunity", value: usd(m.recoveryOpportunity) },
        ];

  return (
    <div className="space-y-4">
      <p className="text-sm">{report.summary}</p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-muted/30 rounded-lg border p-3">
            <div className="text-lg font-semibold">{c.value}</div>
            <div className="text-muted-foreground text-xs">{c.label}</div>
          </div>
        ))}
      </div>

      {report.highlights.length > 0 ? (
        <div>
          <h4 className="text-muted-foreground mb-1 text-xs font-semibold uppercase">Highlights</h4>
          <ul className="divide-y rounded-lg border">
            {report.highlights.slice(0, 8).map((h, i) => (
              <li
                key={`${h.externalRef}-${i}`}
                className="flex items-start justify-between gap-2 px-3 py-2"
              >
                <div className="min-w-0">
                  <span className="text-sm font-medium">{h.name}</span>{" "}
                  <span className="text-muted-foreground text-xs">{h.externalRef}</span>
                  <div className="text-muted-foreground text-xs">{h.reason}</div>
                </div>
                <div className="shrink-0 text-right text-xs">
                  <div>{usd(h.mrr)}/mo</div>
                  <div className="text-destructive">{h.usageChangePct}%</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {report.recommendations.length > 0 ? (
        <div>
          <h4 className="text-muted-foreground mb-1 text-xs font-semibold uppercase">
            Recommendations
          </h4>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {report.recommendations.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="text-muted-foreground text-xs">
        Agents: {report.agentsInvolved.join(", ")}
        {totals ? ` · ${totals.toolCalls} tool calls · ${totals.steps} steps` : ""}
      </div>
    </div>
  );
}
