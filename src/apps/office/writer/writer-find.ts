import type { Editor } from '@tiptap/core';

export interface WriterMatch { from: number; to: number }

export function findWriterMatches(editor: Editor, query: string): WriterMatch[] {
  const needle = query.slice(0, 200);
  if (!needle) return [];
  const expression = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu');
  const matches: WriterMatch[] = [];
  editor.state.doc.descendants((node, position) => {
    if (!node.isText || !node.text) return;
    expression.lastIndex = 0;
    let match = expression.exec(node.text);
    while (match && matches.length < 5_000) {
      matches.push({ from: position + match.index, to: position + match.index + match[0].length });
      if (match[0].length === 0) expression.lastIndex += 1;
      match = expression.exec(node.text);
    }
  });
  return matches;
}

export function selectWriterMatch(editor: Editor, match: WriterMatch): void {
  editor.chain().focus().setTextSelection(match).scrollIntoView().run();
}

export function replaceWriterMatches(editor: Editor, matches: WriterMatch[], replacement: string, onlyFirst = false): number {
  if (!matches.length || replacement.length > 2_000) return 0;
  const selected = (onlyFirst ? matches.slice(0, 1) : [...matches].reverse());
  const transaction = editor.state.tr;
  for (const match of selected) {
    if (replacement) transaction.insertText(replacement, match.from, match.to);
    else transaction.delete(match.from, match.to);
  }
  editor.view.dispatch(transaction);
  return selected.length;
}
