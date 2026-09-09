import { index, integer, pgTable, text, uuid, vector } from "drizzle-orm/pg-core";

import { docStatus } from "./_enums";
import { createdAt, pk } from "./_helpers";
import { organizations, users } from "./organizations";

export const documents = pgTable(
  "documents",
  {
    id: pk(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull().default(0),
    status: docStatus("status").notNull().default("processing"),
    chunkCount: integer("chunk_count").notNull().default(0),
    uploadedByUserId: uuid("uploaded_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    storageRef: text("storage_ref"),
    createdAt: createdAt(),
  },
  (t) => [index("documents_organization_id_idx").on(t.organizationId)],
);

export const documentChunks = pgTable(
  "document_chunks",
  {
    id: pk(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    /** 1536-dim embedding (OpenAI text-embedding-3-small default). Null until embedded.
     *  ANN index (hnsw/ivfflat) is added in Phase 9 once the embedding model is fixed. */
    embedding: vector("embedding", { dimensions: 1536 }),
    tokenCount: integer("token_count"),
    createdAt: createdAt(),
  },
  (t) => [index("document_chunks_document_id_idx").on(t.documentId)],
);
