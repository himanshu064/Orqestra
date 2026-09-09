export type MiniBar = { label: string; value: number };

/** Compact vertical bar chart (e.g. runs per day). Bars scale to the max value. */
export function MiniBars({ data, unit = "" }: { data: MiniBar[]; unit?: string }) {
  if (data.length === 0) {
    return <p className="text-muted-foreground text-sm">No data yet.</p>;
  }
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="space-y-2">
      <div className="flex items-stretch gap-1.5" style={{ height: 140 }}>
        {data.map((d) => {
          const pct = (d.value / max) * 100;
          const has = d.value > 0;
          return (
            <div key={d.label} className="group flex flex-1 flex-col justify-end">
              <div
                className={
                  has
                    ? "bg-primary/80 group-hover:bg-primary w-full rounded-t-sm transition-all"
                    : "bg-muted w-full rounded-t-sm"
                }
                style={{ height: has ? `${Math.max(6, pct)}%` : "3px" }}
                title={`${d.label}: ${d.value}${unit}`}
                aria-label={`${d.label}: ${d.value}${unit}`}
              />
            </div>
          );
        })}
      </div>
      <div className="border-border/60 flex gap-1.5 border-t pt-1.5">
        {data.map((d) => (
          <span
            key={d.label}
            className="text-muted-foreground flex-1 text-center text-[10px] tabular-nums"
          >
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}
