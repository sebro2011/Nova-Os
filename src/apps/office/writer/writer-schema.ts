import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import CharacterCount from '@tiptap/extension-character-count';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import { Color, FontFamily, FontSize, TextStyle } from '@tiptap/extension-text-style';
import type { Extensions } from '@tiptap/core';

export const writerExtensions: Extensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3, 4, 5, 6] },
    link: {
      openOnClick: false,
      autolink: false,
      linkOnPaste: true,
      HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer nofollow' },
    },
  }),
  Image.configure({ allowBase64: true, HTMLAttributes: { loading: 'lazy', decoding: 'async' } }),
  TextAlign.configure({ types: ['heading', 'paragraph'], alignments: ['left', 'center', 'right', 'justify'] }),
  TextStyle,
  Color,
  FontFamily,
  FontSize,
  Table.configure({ resizable: false, renderWrapper: true }),
  TableRow,
  TableHeader,
  TableCell,
  CharacterCount.configure({ limit: 2_000_000 }),
];
