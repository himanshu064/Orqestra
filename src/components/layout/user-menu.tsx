"use client";

import { LogOut } from "lucide-react";

import { signOutAction } from "@/auth/actions";
import { Button } from "@/components/ui/button";

function initialsOf(label: string): string {
  return label
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function UserMenu({ name, email }: { name?: string | null; email?: string | null }) {
  const label = name || email || "User";

  return (
    <div className="flex items-center gap-2 pl-1">
      <div className="bg-muted flex size-8 items-center justify-center rounded-full text-xs font-medium">
        {initialsOf(label)}
      </div>
      <div className="hidden leading-tight sm:block">
        <div className="text-sm font-medium">{label}</div>
      </div>
      <form action={signOutAction}>
        <Button type="submit" variant="ghost" size="icon" aria-label="Sign out">
          <LogOut />
        </Button>
      </form>
    </div>
  );
}
