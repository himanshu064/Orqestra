"use server";

import { AuthError } from "next-auth";

import { signIn, signOut } from "./index";

/** Login server action used by the login form (React 19 useActionState). */
export async function authenticate(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/dashboard",
    });
  } catch (error) {
    // signIn throws a NEXT_REDIRECT on success  that must propagate.
    if (error instanceof AuthError) {
      return "Invalid email or password.";
    }
    throw error;
  }
}

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}
