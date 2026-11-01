import { afterEach, describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import { writerExtensions } from './writer-schema';
import { findWriterMatches, replaceWriterMatches } from './writer-find';

let editor: Editor | undefined;
afterEach(() => {
  editor?.destroy();
  editor = undefined;
});

describe('Writer find and replace', () => {
  it('finds case-insensitive literal text and replace-all is one undoable transaction', () => {
    editor = new Editor({
      element: document.createElement('div'),
      extensions: writerExtensions,
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Alpha beta alpha [literal]' }] }] },
    });
    const matches = findWriterMatches(editor, 'alpha');
    expect(matches).toHaveLength(2);
    expect(findWriterMatches(editor, '[literal]')).toHaveLength(1);
    expect(replaceWriterMatches(editor, matches, 'Gamma')).toBe(2);
    expect(editor.getText()).toBe('Gamma beta Gamma [literal]');
    editor.commands.undo();
    expect(editor.getText()).toBe('Alpha beta alpha [literal]');
  });
});
