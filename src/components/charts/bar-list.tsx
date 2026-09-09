export type BarItem = { label: string; value: number; hint?: string };

/** Horizontal labelled bars, sized relative to the largest value. */
export function BarList({ items, valueFormat }: { items: BarItem[]; valueFormat?: (v: number) => string }) {
  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm">No data yet.</p>;
  }
  const max = Math.max(...items.map((i) => i.value), 1);
  const fmt = valueFormat ?? ((v: number) => v.toLocaleString("en-US"));

  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item.label} className="space-y-1">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate font-medium">{item.label}</span>
            <span className="text-muted-foreground shrink-0 tabular-nums">
              {item.hint ?? fmt(item.value)}
            </span>
          </div>
          <div className="bg-muted h-2 overflow-hidden rounded-full">
            <div
              className="bg-primary h-full rounded-full"
              style={{ width: `${Math.max(4, (item.value / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
