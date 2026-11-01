import type { JSONContent } from '@tiptap/core';
import { validateWriterDocument, type WriterDocument } from '../core/document-model/writer-model';

export function writerPlainText(value: WriterDocument): string {
  const document = validateWriterDocument(value);
  const lines: string[] = [];
  const visit = (nodes: JSONContent[] | undefined) => {
    for (const node of nodes ?? []) {
      if (node.type === 'text') lines.push(node.text ?? '');
      else if (node.type === 'hardBreak') lines.push('\n');
      else {
        if (node.content) visit(node.content);
        if (['paragraph', 'heading', 'listItem', 'tableRow'].includes(String(node.type))) lines.push('\n');
        else if (node.type === 'tableCell' || node.type === 'tableHeader') lines.push('\t');
      }
    }
  };
  visit(document.content.content);
  return lines.join('').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}
