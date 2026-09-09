import { GuardrailError } from "@/ai/guardrails";
import { AiNotConfiguredError } from "@/ai/provider";

/**
 * Map an error to a message safe to show an end user. Intended, user-facing errors
 * (guardrail breaches, "provider not configured") pass through verbatim; everything else
 * (DB/driver/provider internals) is replaced with a generic message. Log the raw error
 * server-side separately.
 */
export function toClientError(
  err: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (err instanceof GuardrailError || err instanceof AiNotConfiguredError) return err.message;
  return fallback;
}
