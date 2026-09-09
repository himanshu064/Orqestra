import "server-only";

import { env } from "@/env";

/**
 * Outbound email. Sends via Resend when EMAIL_API_KEY is configured; otherwise returns a mock
 * success so the demo works without a provider. Called from the approval engine after a human
 * approves a `send_email` action (§26, §37).
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const DEFAULT_FROM = "Orqestra <onboarding@resend.dev>";

export type SendEmailResult = {
  ok: boolean;
  provider: "resend" | "mock";
  id?: string;
  error?: string;
};

export async function sendEmail(input: {
  to: string;
  subject: string;
  body: string;
}): Promise<SendEmailResult> {
  const key = env.EMAIL_API_KEY;

  // No provider configured  mock (default for local/demo).
  if (!key) {
    return { ok: true, provider: "mock", id: `mock-${Date.now().toString(36)}` };
  }

  const from = env.EMAIL_FROM || DEFAULT_FROM;
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        text: input.body,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
    if (!res.ok) {
      return {
        ok: false,
        provider: "resend",
        error: data.message ?? data.name ?? `Resend returned HTTP ${res.status}`,
      };
    }
    return { ok: true, provider: "resend", id: data.id };
  } catch (err) {
    return {
      ok: false,
      provider: "resend",
      error: err instanceof Error ? err.message : "Email send failed",
    };
  }
}
