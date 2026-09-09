import { redirect } from "next/navigation";

import { auth } from "./index";

/** The current session user, or null if not authenticated. */
export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}

/**
 * Data Access Layer guard (Next 16 recommended pattern): resolve the current user or
 * redirect to /login. Call this in server layouts / pages / route handlers that require auth.
 */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export type AppRole = "admin" | "manager" | "analyst" | "employee";

/** Authorization check for sensitive actions (RBAC). Returns true if the user holds one of `roles`. */
export function hasRole(
  user: { role?: string | null } | null | undefined,
  roles: AppRole[],
): boolean {
  return !!user?.role && (roles as string[]).includes(user.role);
}

/** Roles allowed to perform sensitive/destructive actions (approve, change settings, delete data). */
export const PRIVILEGED_ROLES: AppRole[] = ["admin", "manager"];
