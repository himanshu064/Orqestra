import { getCurrentUser } from "@/auth/dal";
import { json } from "@/lib/http";
import { ingestDocument, listDocuments } from "@/services/documents";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_EXTENSIONS = new Set(["txt", "md", "markdown", "pdf", "docx"]);
const ALLOWED_MIME = new Set([
  "text/plain",
  "text/markdown",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/octet-stream", // some browsers send this; extension check still applies
]);

export async function GET(): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return json({ error: "Unauthorized" }, 401);
  return Response.json(await listDocuments(user.organizationId));
}

export async function POST(req: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return json({ error: "Unauthorized" }, 401);

  // Cheap early reject on the declared size before buffering anything.
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared && declared > MAX_UPLOAD_BYTES) {
    return json({ error: "File too large (max 10 MB)." }, 413);
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return json({ error: "A file is required." }, 400);

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mime = file.type || "application/octet-stream";
  if (!ALLOWED_EXTENSIONS.has(ext) || !ALLOWED_MIME.has(mime)) {
    return json({ error: "Unsupported file type. Upload a PDF, DOCX, TXT, or Markdown file." }, 415);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return json({ error: "File too large (max 10 MB)." }, 413);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  // Authoritative size check (a lying Content-Length can't sneak a large body past us).
  if (buffer.length > MAX_UPLOAD_BYTES) {
    return json({ error: "File too large (max 10 MB)." }, 413);
  }

  try {
    const result = await ingestDocument(
      { organizationId: user.organizationId, userId: user.id },
      { name: file.name, mimeType: mime, buffer },
    );
    return Response.json(result, { status: 201 });
  } catch (err) {
    console.error("[documents] ingest failed", err);
    return json({ error: "Could not process the document. Please try a different file." }, 500);
  }
}
