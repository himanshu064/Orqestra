export type TextChunk = { content: string; index: number };

/**
 * Paragraph-aware chunking: pack paragraphs up to ~`size` chars; hard-split any paragraph
 * longer than `size` with `overlap`. Pure and deterministic.
 */
export function chunkText(text: string, opts?: { size?: number; overlap?: number }): TextChunk[] {
  const size = opts?.size ?? 900;
  const overlap = opts?.overlap ?? 150;

  const clean = text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!clean) return [];

  const paragraphs = clean
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const out: string[] = [];
  let current = "";
  const flush = () => {
    if (current.trim()) out.push(current.trim());
    current = "";
  };

  for (const p of paragraphs) {
    if (p.length > size) {
      flush();
      const step = Math.max(1, size - overlap);
      for (let i = 0; i < p.length; i += step) out.push(p.slice(i, i + size).trim());
      continue;
    }
    const candidate = current ? `${current}\n\n${p}` : p;
    if (candidate.length > size) {
      flush();
      current = p;
    } else {
      current = candidate;
    }
  }
  flush();

  return out.map((content, index) => ({ content, index }));
}
