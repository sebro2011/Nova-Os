export interface PdfTextItemLike {
  str?: unknown;
  hasEOL?: unknown;
}

export interface PdfSearchMatch {
  pageNumber: number;
  excerpt: string;
}

export function pdfTextContentToString(items: unknown[]): string {
  let text = '';
  for (const value of items) {
    if (typeof value !== 'object' || value === null) continue;
    const item = value as PdfTextItemLike;
    if (typeof item.str !== 'string') continue;
    text += item.str;
    text += item.hasEOL === true ? '\n' : ' ';
  }
  return text;
}

export function findPdfPageMatches(pageNumber: number, value: string, query: string, limit = 100): PdfSearchMatch[] {
  const needle = query.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  if (!needle || limit <= 0) return [];
  const text = value.replace(/\s+/g, ' ').trim();
  const normalized = text.toLocaleLowerCase();
  const matches: PdfSearchMatch[] = [];
  let offset = 0;
  while (offset <= normalized.length - needle.length && matches.length < limit) {
    const index = normalized.indexOf(needle, offset);
    if (index < 0) break;
    const start = Math.max(0, index - 55);
    const end = Math.min(text.length, index + needle.length + 75);
    matches.push({ pageNumber, excerpt: `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}` });
    offset = index + Math.max(1, needle.length);
  }
  return matches;
}
