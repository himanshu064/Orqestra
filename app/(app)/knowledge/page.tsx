import { requireUser } from "@/auth/dal";
import { KnowledgeManager, type DocumentSummary } from "@/components/knowledge/knowledge-manager";
import { listDocuments } from "@/services/documents";

export const metadata = { title: "Knowledge Base" };

export default async function KnowledgePage() {
  const user = await requireUser();
  const docs = await listDocuments(user.organizationId);
  const initial: DocumentSummary[] = docs.map((d) => ({
    id: d.id,
    name: d.name,
    mimeType: d.mimeType,
    sizeBytes: d.sizeBytes,
    status: d.status,
    chunkCount: d.chunkCount,
    createdAt: d.createdAt.toISOString(),
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Knowledge Base</h2>
        <p className="text-muted-foreground text-sm">
          Upload company documents for the Research Agent to search via RAG.
        </p>
      </div>

      <KnowledgeManager initialDocuments={initial} />
    </div>
  );
}
