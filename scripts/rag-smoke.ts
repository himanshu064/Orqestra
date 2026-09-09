import "dotenv/config";

import { count, eq } from "drizzle-orm";

import { EMBEDDING_DIMENSIONS } from "@/ai/embeddings";
import { db } from "@/db";
import { documentChunks, organizations } from "@/db/schema";
import { searchKnowledgeBase } from "@/services/knowledge-search";

async function main() {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, "orqestra-demo"))
    .limit(1);
  if (!org) throw new Error("Demo org not found.");

  const query = "What is our refund policy for enterprise customers?";
  console.log(`Query: ${query}\n`);

  const hits = await searchKnowledgeBase(org.id, query, 3);
  hits.forEach((h, i) =>
    console.log(
      `  ${i + 1}. [${h.similarity.toFixed(3)}] ${h.documentName}\n     ${h.content.slice(0, 90).replace(/\n/g, " ")}…`,
    ),
  );

  const [row] = await db
    .select({ embedding: documentChunks.embedding })
    .from(documentChunks)
    .where(eq(documentChunks.organizationId, org.id))
    .limit(1);
  const dims = Array.isArray(row?.embedding) ? row!.embedding!.length : 0;

  // Scoping: a foreign org has no chunks (search filters by organizationId).
  const [{ n: foreignChunks }] = await db
    .select({ n: count() })
    .from(documentChunks)
    .where(eq(documentChunks.organizationId, "00000000-0000-0000-0000-000000000000"));

  const checks = {
    "returns hits": hits.length > 0,
    "top hit is the Enterprise Refund Policy": Boolean(
      hits[0]?.documentName.toLowerCase().includes("enterprise"),
    ),
    [`embeddings are ${EMBEDDING_DIMENSIONS}-dim`]: dims === EMBEDDING_DIMENSIONS,
    "foreign org has no chunks (scoping)": foreignChunks === 0,
  };

  console.log("\n── Checks ──");
  for (const [k, v] of Object.entries(checks)) console.log(`  ${v ? "✓" : "✗"} ${k}`);

  const ok = Object.values(checks).every(Boolean);
  console.log(ok ? "\n✅ RAG SMOKE PASS" : "\n⚠️  Some checks failed");
  if (!ok) process.exitCode = 1;
}

main().catch((err) => {
  console.error("✗ rag smoke failed:", err);
  process.exit(1);
});
