/** Extract plain text from an uploaded document (TXT/MD/DOCX/PDF). */
export async function extractText(
  mimeType: string,
  filename: string,
  buffer: Buffer,
): Promise<string> {
  const name = filename.toLowerCase();

  if (mimeType.startsWith("text/") || name.endsWith(".txt") || name.endsWith(".md")) {
    return buffer.toString("utf8");
  }

  if (mimeType.includes("word") || name.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (mimeType === "application/pdf" || name.endsWith(".pdf")) {
    const { extractText: pdfExtractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await pdfExtractText(pdf, { mergePages: true });
    return Array.isArray(text) ? text.join("\n") : text;
  }

  // Fallback: best-effort UTF-8.
  return buffer.toString("utf8");
}
