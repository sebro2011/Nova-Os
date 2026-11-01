import { describe, expect, it } from 'vitest';
import { importPlainText, sanitizeImportedHtml } from './writer-import';
import { createWriterDocument } from '../core/document-model/writer-model';

const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

describe('Writer import sanitization', () => {
  it('removes active content and unsafe URLs while preserving readable text and supported styles', () => {
    const result = sanitizeImportedHtml(`<p onclick="alert(1)">Hello<script>alert(2)</script><a href="javascript:alert(3)">link text</a><img src="https://tracker.example/pixel"><span style="color:#ff0000;background-image:url(https://tracker.example/x)"> styled</span></p><img src="${tinyPng}" alt="Local" onerror="alert(4)">`);
    expect(result.html).toContain('Hello');
    expect(result.html).toContain('link text');
    expect(result.html).toContain('color:#ff0000');
    expect(result.html).toContain(tinyPng);
    expect(result.html).not.toContain('script');
    expect(result.html).not.toContain('onclick');
    expect(result.html).not.toContain('onerror');
    expect(result.html).not.toContain('javascript:');
    expect(result.html).not.toContain('tracker.example');
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('imports bounded plain text with Unicode and empty lines', () => {
    const document = importPlainText('Hello\n\nආයුබෝවන්\nவணக்கம்', createWriterDocument().page);
    expect(JSON.stringify(document.content)).toContain('ආයුබෝවන්');
    expect(JSON.stringify(document.content)).toContain('வணக்கம்');
    expect(document.content.content).toHaveLength(4);
    expect(() => importPlainText('x'.repeat(2_000_001), createWriterDocument().page)).toThrow('limited');
  });
});
