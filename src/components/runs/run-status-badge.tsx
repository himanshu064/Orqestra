import { Tag } from "@/components/ui/tag";
import { runStatusMeta } from "@/lib/status";

export function RunStatusBadge({ status }: { status: string }) {
  const meta = runStatusMeta(status);
  return (
    <Tag tone={meta.tone} className="h-6 px-2.5 text-xs">
      {meta.label}
    </Tag>
  );
}
