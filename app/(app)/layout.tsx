import type { ReactNode } from "react";

import { requireUser } from "@/auth/dal";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: ReactNode }) {
  // DAL guard: redirects to /login when unauthenticated (Next 16 recommended pattern).
  const user = await requireUser();

  return <AppShell user={{ name: user.name, email: user.email }}>{children}</AppShell>;
}
