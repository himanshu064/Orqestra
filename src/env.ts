import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Typed, validated environment variables.
 *
 * Phase 0: every variable is OPTIONAL so the app boots without a real `.env`.
 * Later phases tighten these:
 *   - Phase 1 (DB):   DATABASE_URL becomes required
 *   - Phase 3 (Auth): AUTH_SECRET becomes required
 *   - Phase 4 (BYO):  SETTINGS_ENCRYPTION_KEY becomes required
 *
 * Note: LLM provider API keys are intentionally NOT env vars  they are entered
 * in Settings and stored encrypted in the database (see requirements §55, §48).
 */
export const env = createEnv({
  server: {
    // Required from Phase 1 onward.
    DATABASE_URL: z.string().min(1),
    // Required from Phase 3 onward (Auth.js session signing).
    AUTH_SECRET: z.string().min(1),
    // Required from Phase 4 onward (encrypts BYO provider API keys at rest).
    SETTINGS_ENCRYPTION_KEY: z.string().min(1),
    // Optional: Resend API key. When set, approved emails are actually sent; otherwise mocked.
    EMAIL_API_KEY: z.string().optional(),
    // Optional: verified sender for outbound email (defaults to Resend's onboarding address).
    EMAIL_FROM: z.string().optional(),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().min(1).optional(),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    SETTINGS_ENCRYPTION_KEY: process.env.SETTINGS_ENCRYPTION_KEY,
    EMAIL_API_KEY: process.env.EMAIL_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
  // Treat empty strings as undefined so a blank line in .env doesn't pass validation.
  emptyStringAsUndefined: true,
});
