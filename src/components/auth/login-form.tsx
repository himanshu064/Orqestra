"use client";

import { useActionState } from "react";

import { authenticate } from "@/auth/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const [errorMessage, formAction, isPending] = useActionState(authenticate, undefined);

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <div className="mb-1 flex items-center gap-2">
          <div className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md text-sm font-bold">
            O
          </div>
          <span className="text-base font-semibold tracking-tight">Orqestra</span>
        </div>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Agentic AI Operations Platform</CardDescription>
      </CardHeader>
      <form action={formAction}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              defaultValue="manager@orqestra.demo"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          {errorMessage ? (
            <p className="text-destructive text-sm" role="alert">
              {errorMessage}
            </p>
          ) : null}
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Signing in…" : "Sign in"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
