import type { DefaultSession } from "next-auth";

import type { User as DbUser } from "@/db/types";

type Role = DbUser["role"];

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      organizationId: string;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
    organizationId: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    role: Role;
    organizationId: string;
  }
}
