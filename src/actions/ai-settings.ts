"use server";

import { generateText } from "ai";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { AiNotConfiguredError, resolveModel } from "@/ai/provider";
import { hasRole, PRIVILEGED_ROLES, requireUser } from "@/auth/dal";
import { saveAiSettings } from "@/services/ai-settings";

export type ActionResult = { ok: boolean; message: string };

const saveSchema = z.object({
  provider: z.enum(["anthropic", "openai", "google"]),
  model: z.string().min(1),
  embeddingModel: z.string().optional(),
  apiKey: z.string().optional(),
  embeddingProvider: z.enum(["anthropic", "openai", "google"]).optional(),
  embeddingApiKey: z.string().optional(),
});

export async function saveSettingsAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!hasRole(user, PRIVILEGED_ROLES)) {
    return { ok: false, message: "You don't have permission to change AI settings." };
  }

  const embeddingProvider = (formData.get("embeddingProvider") as string | null) || undefined;
  const parsed = saveSchema.safeParse({
    provider: formData.get("provider"),
    model: (formData.get("model") as string | null)?.trim(),
    embeddingModel: (formData.get("embeddingModel") as string | null) || undefined,
    apiKey: (formData.get("apiKey") as string | null) || undefined,
    embeddingProvider,
    embeddingApiKey: (formData.get("embeddingApiKey") as string | null) || undefined,
  });
  if (!parsed.success) {
    return { ok: false, message: "Choose a provider and enter a model name." };
  }

  await saveAiSettings(user.organizationId, user.id, {
    ...parsed.data,
    // Explicit null clears the dedicated embeddings provider when not supplied.
    embeddingProvider: parsed.data.embeddingProvider ?? null,
  });
  revalidatePath("/settings");
  return { ok: true, message: "Settings saved." };
}

export async function testConnectionAction(): Promise<ActionResult> {
  const user = await requireUser();
  if (!hasRole(user, PRIVILEGED_ROLES)) {
    return { ok: false, message: "You don't have permission to test the AI connection." };
  }
  try {
    const model = await resolveModel(user.organizationId);
    await generateText({ model, prompt: "Reply with the single word: ok", maxOutputTokens: 8 });
    return { ok: true, message: "Connection successful." };
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      return { ok: false, message: err.message };
    }
    const raw = err instanceof Error ? err.message : "Unknown error";
    const friendly =
      /api[\s_-]?key|401|403|unauthor|permission|invalid|forbidden|authentication/i.test(raw)
        ? "Connection failed: the API key was rejected. Check the key and model name."
        : `Connection failed: ${raw}`;
    return { ok: false, message: friendly };
  }
}
