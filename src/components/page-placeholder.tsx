import { Construction } from "lucide-react";
import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type PagePlaceholderProps = {
  title: string;
  description?: string;
  /** The implementation plan phase that will build this page out. */
  phase?: string;
  children?: ReactNode;
};

export function PagePlaceholder({ title, description, phase, children }: PagePlaceholderProps) {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Construction className="text-muted-foreground size-5" />
            <CardTitle>Coming soon</CardTitle>
          </div>
          <CardDescription>
            This screen is a placeholder from Phase 0 (Foundation). It will be built out
            {phase ? ` in ${phase}` : " in a later phase"}.
          </CardDescription>
        </CardHeader>
        {children ? <CardContent>{children}</CardContent> : null}
      </Card>
    </div>
  );
}
