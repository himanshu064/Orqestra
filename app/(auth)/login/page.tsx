import { redirect } from "next/navigation";

import { getCurrentUser } from "@/auth/dal";
import { LoginForm } from "@/components/auth/login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  // Already signed in? Skip the form.
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return <LoginForm />;
}
