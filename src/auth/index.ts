import { eq } from "drizzle-orm";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

import { db } from "@/db";
import { users } from "@/db/schema";
import { clearLoginFailures, isLoginBlocked, recordLoginFailure } from "@/lib/rate-limit";

import { verifyPassword } from "./password";

const credentialsSchema = z.object({
  email: z.string().min(3),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  trustHost: true,
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const email = parsed.data.email.toLowerCase();

        // Throttle credential stuffing: lock the identifier after repeated failures.
        if (isLoginBlocked(email)) return null;

        const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
        if (!user || !user.hashedPassword) {
          recordLoginFailure(email);
          return null;
        }

        const ok = await verifyPassword(parsed.data.password, user.hashedPassword);
        if (!ok) {
          recordLoginFailure(email);
          return null;
        }

        clearLoginFailures(email);
        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          role: user.role,
          organizationId: user.organizationId,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.userId = user.id as string;
        token.role = user.role;
        token.organizationId = user.organizationId;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string;
        session.user.role = token.role as (typeof session.user)["role"];
        session.user.organizationId = token.organizationId as string;
      }
      return session;
    },
  },
});
