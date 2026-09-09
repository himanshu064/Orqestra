import { embedMany } from "ai";

import { resolveEmbeddingModel } from "@/ai/provider";

/** All providers are standardized to 1536-dim embeddings (matches document_chunks.embedding). */
export const EMBEDDING_DIMENSIONS = 1536;

export type EmbedTaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

const BATCH = 96;

/** Embed a list of texts (batched), returning one 1536-dim vector per text. */
export async function embedTexts(
  orgId: string,
  texts: string[],
  taskType: EmbedTaskType,
): Promise<number[][]> {
  if (texts.length === 0) return [];
  const model = await resolveEmbeddingModel(orgId);

  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const { embeddings } = await embedMany({
      model,
      values: texts.slice(i, i + BATCH),
      maxRetries: 4,
      // Google needs the explicit dimensionality; ignored by providers that are natively 1536.
      providerOptions: {
        google: { outputDimensionality: EMBEDDING_DIMENSIONS, taskType },
      },
    });
    out.push(...embeddings);
  }
  return out;
}

export async function embedQuery(orgId: string, text: string): Promise<number[]> {
  const [vector] = await embedTexts(orgId, [text], "RETRIEVAL_QUERY");
  return vector!;
}
