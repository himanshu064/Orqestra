import { and, desc, eq } from "drizzle-orm";

import { embedTexts } from "@/ai/embeddings";
import type { ToolContext } from "@/ai/tools/context";
import { db } from "@/db";
import { documentChunks, documents } from "@/db/schema";
import { chunkText } from "@/lib/chunk";
import { extractText } from "@/lib/extract";

export type IngestInput = { name: string; mimeType: string; buffer: Buffer };

/** Extract → chunk → embed → store a document into the knowledge base (§19). */
export async function ingestDocument(
  ctx: ToolContext,
  input: IngestInput,
): Promise<{ id: string; chunkCount: number }> {
  const [doc] = await db
    .insert(documents)
    .values({
      organizationId: ctx.organizationId,
      name: input.name,
      mimeType: input.mimeType,
      sizeBytes: input.buffer.length,
      status: "processing",
      uploadedByUserId: ctx.userId,
    })
    .returning({ id: documents.id });
  const docId = doc!.id;

  try {
    const text = await extractText(input.mimeType, input.name, input.buffer);
    const chunks = chunkText(text);

    if (chunks.length === 0) {
      await db
        .update(documents)
        .set({ status: "ready", chunkCount: 0 })
        .where(eq(documents.id, docId));
      return { id: docId, chunkCount: 0 };
    }

    const embeddings = await embedTexts(
      ctx.organizationId,
      chunks.map((c) => c.content),
      "RETRIEVAL_DOCUMENT",
    );

    await db.insert(documentChunks).values(
      chunks.map((c, i) => ({
        organizationId: ctx.organizationId,
        documentId: docId,
        chunkIndex: c.index,
        content: c.content,
        embedding: embeddings[i]!,
        tokenCount: Math.ceil(c.content.length / 4),
      })),
    );

    await db
      .update(documents)
      .set({ status: "ready", chunkCount: chunks.length })
      .where(eq(documents.id, docId));

    return { id: docId, chunkCount: chunks.length };
  } catch (err) {
    await db.update(documents).set({ status: "failed" }).where(eq(documents.id, docId));
    throw err;
  }
}

export async function listDocuments(orgId: string) {
  return db
    .select()
    .from(documents)
    .where(eq(documents.organizationId, orgId))
    .orderBy(desc(documents.createdAt));
}

export async function deleteDocument(orgId: string, id: string): Promise<void> {
  await db.delete(documents).where(and(eq(documents.organizationId, orgId), eq(documents.id, id)));
}
