"use client";

import { FileText, Loader2, Trash2, Upload } from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tag, type TagTone } from "@/components/ui/tag";

const DOC_STATUS_TONE: Record<string, TagTone> = {
  ready: "emerald",
  processing: "sky",
  failed: "rose",
};

export type DocumentSummary = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
  chunkCount: number;
  createdAt: string;
};

export function KnowledgeManager({ initialDocuments }: { initialDocuments: DocumentSummary[] }) {
  const [docs, setDocs] = useState<DocumentSummary[]>(initialDocuments);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    const res = await fetch("/api/documents");
    if (res.ok) setDocs((await res.json()) as DocumentSummary[]);
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/documents", { method: "POST", body: fd });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(body.error ?? "Upload failed");
      } else {
        const r = (await res.json()) as { chunkCount: number };
        toast.success(`Uploaded  ${r.chunkCount} chunk${r.chunkCount === 1 ? "" : "s"} indexed`);
        await refresh();
      }
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onDelete(id: string) {
    const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
    if (res.status === 204 || res.ok) {
      setDocs((prev) => prev.filter((d) => d.id !== id));
      toast.success("Document deleted");
    } else {
      toast.error("Delete failed");
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <div className="text-sm font-medium">Upload a document</div>
            <div className="text-muted-foreground text-xs">
              PDF, DOCX, TXT, or Markdown  chunked and embedded for semantic search.
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.docx,.txt,.md,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={onFile}
            disabled={uploading}
          />
          <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Indexing…
              </>
            ) : (
              <>
                <Upload className="size-4" /> Upload
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <div className="text-muted-foreground text-sm">Documents: {docs.length}</div>

      {docs.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground text-sm">
            No documents yet. Upload one to get started.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {docs.map((d) => (
            <li key={d.id}>
              <Card>
                <CardContent className="flex items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <FileText className="text-muted-foreground size-5 shrink-0" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{d.name}</div>
                      <div className="text-muted-foreground text-xs">
                        {d.chunkCount} chunk{d.chunkCount === 1 ? "" : "s"} ·{" "}
                        {new Date(d.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Tag tone={DOC_STATUS_TONE[d.status] ?? "amber"}>{d.status}</Tag>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${d.name}`}
                      onClick={() => onDelete(d.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
