import { and, cosineDistance, desc, eq, isNotNull, sql } from "drizzle-orm";

import { embedQuery } from "@/ai/embeddings";
import { db } from "@/db";
import { documentChunks, documents } from "@/db/schema";

export type KbHit = {
  content: string;
  documentId: string;
  documentName: string;
  chunkIndex: number;
  similarity: number;
};

/** Semantic search over the org's knowledge base (§19, §21). Brute-force cosine  demo scale. */
export async function searchKnowledgeBase(orgId: string, query: string, k = 5): Promise<KbHit[]> {
  const queryVector = await embedQuery(orgId, query);
  const similarity = sql<number>`1 - (${cosineDistance(documentChunks.embedding, queryVector)})`;

  return db
    .select({
      content: documentChunks.content,
      documentId: documentChunks.documentId,
      documentName: documents.name,
      chunkIndex: documentChunks.chunkIndex,
      similarity,
    })
    .from(documentChunks)
    .innerJoin(documents, eq(documentChunks.documentId, documents.id))
    // Exclude un-embedded chunks: a NULL cosine distance sorts NULLS-FIRST (bogus top hits) and
    // would crash callers that format `similarity`.
    .where(
      and(eq(documentChunks.organizationId, orgId), isNotNull(documentChunks.embedding)),
    )
    .orderBy(desc(similarity))
    .limit(k);
}
