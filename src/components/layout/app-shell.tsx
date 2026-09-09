import type { ReactNode } from "react";

import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export type ShellUser = {
  name?: string | null;
  email?: string | null;
};

export function AppShell({ user, children }: { user: ShellUser; children: ReactNode }) {
  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 min-h-0 flex-1 flex-col">
        <Topbar user={user} />
        <main className="min-h-0 flex-1 overflow-y-auto p-5 md:p-8">{children}</main>
      </div>
    </div>
  );
}
