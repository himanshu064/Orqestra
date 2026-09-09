"use client";

import { Check, ShieldCheck, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { approveApprovalAction, rejectApprovalAction } from "@/actions/approvals";
import { ACTION_META, summarizeAction } from "@/config/actions";
import { AGENT_META } from "@/config/agents";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tag, type TagTone } from "@/components/ui/tag";

const STATUS_TONE: Record<string, TagTone> = {
  executed: "emerald",
  approved: "sky",
  rejected: "rose",
  failed: "rose",
  pending: "amber",
};

export type ApprovalItem = {
  id: string;
  actionType: string;
  status: string;
  requestedByAgent: keyof typeof AGENT_META;
  requestedAt: string | null;
  payload: unknown;
  runObjective: string | null;
  executionResult: unknown;
};

function ActionIcon({ actionType }: { actionType: string }) {
  const Icon = ACTION_META[actionType]?.icon ?? ShieldCheck;
  return <Icon className="size-5" />;
}

function ApprovalCard({ item }: { item: ApprovalItem }) {
  const [pending, start] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const router = useRouter();
  const { title, detail } = summarizeAction(item.actionType, item.payload);
  const isPending = item.status === "pending";

  function run(kind: "approve" | "reject") {
    start(async () => {
      const res =
        kind === "approve"
          ? await approveApprovalAction(item.id)
          : await rejectApprovalAction(item.id);
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="text-muted-foreground mt-0.5">
            <ActionIcon actionType={item.actionType} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium">{title}</div>
            {detail ? <div className="text-muted-foreground truncate text-xs">{detail}</div> : null}
            <div className="text-muted-foreground mt-1 text-xs">
              Requested by {AGENT_META[item.requestedByAgent]?.short ?? item.requestedByAgent}
              {item.runObjective ? ` · run: ${item.runObjective.slice(0, 48)}…` : ""}
            </div>
          </div>
        </div>

        {isPending ? (
          <div className="flex shrink-0 items-center gap-2">
            <Button size="sm" onClick={() => setConfirmOpen(true)} disabled={pending}>
              <Check className="size-4" /> Approve
            </Button>
            <Button size="sm" variant="outline" onClick={() => run("reject")} disabled={pending}>
              <X className="size-4" /> Reject
            </Button>
          </div>
        ) : (
          <Tag tone={STATUS_TONE[item.status] ?? "neutral"} className="h-6 px-2.5 text-xs">
            {item.status}
          </Tag>
        )}
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve and execute?</AlertDialogTitle>
            <AlertDialogDescription>
              This will run “{title}”{detail ? `  ${detail}` : ""}. The action executes immediately
              and is recorded in the audit log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => run("approve")}>
              <Check className="size-4" /> Approve &amp; execute
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function ApprovalSection({ title, list }: { title: string; list: ApprovalItem[] }) {
  if (list.length === 0) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-muted-foreground text-xs font-semibold uppercase">
        {title} ({list.length})
      </h3>
      <ul className="space-y-2">
        {list.map((i) => (
          <li key={i.id}>
            <ApprovalCard item={i} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ApprovalsList({ items }: { items: ApprovalItem[] }) {
  const pending = items.filter((i) => i.status === "pending");
  const decided = items.filter((i) => i.status === "executed" || i.status === "approved");
  const rejected = items.filter((i) => i.status === "rejected" || i.status === "failed");

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground text-sm">
          No approvals yet. When an agent proposes a sensitive action (like sending an email), it
          will appear here for your review.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <ApprovalSection title="Pending" list={pending} />
      <ApprovalSection title="Approved & executed" list={decided} />
      <ApprovalSection title="Rejected" list={rejected} />
    </div>
  );
}
