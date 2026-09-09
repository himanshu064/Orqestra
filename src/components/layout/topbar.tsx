"use client";

import { usePathname } from "next/navigation";

import type { ShellUser } from "@/components/layout/app-shell";
import { UserMenu } from "@/components/layout/user-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { getNavItem } from "@/config/nav";

export function Topbar({ user }: { user: ShellUser }) {
  const pathname = usePathname();
  const current = getNavItem(pathname);

  return (
    <header className="bg-background flex h-14 shrink-0 items-center justify-between border-b px-5">
      <div className="flex flex-col">
        <h1 className="text-sm font-semibold">{current?.title ?? "Orqestra"}</h1>
        {current?.description ? (
          <p className="text-muted-foreground hidden text-xs sm:block">{current.description}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <UserMenu name={user.name} email={user.email} />
      </div>
    </header>
  );
}
