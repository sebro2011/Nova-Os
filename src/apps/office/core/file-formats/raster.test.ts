import { describe, expect, it } from 'vitest';
import { readRasterInfo } from './raster';

const tinyPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const tinyPngUrl = `data:image/png;base64,${tinyPng}`;

describe('Office raster validation', () => {
  it('verifies PNG signatures and dimensions', () => {
    const result = readRasterInfo(tinyPngUrl);
    expect(result.width).toBe(1);
    expect(result.height).toBe(1);
    expect(result.mimeType).toBe('image/png');
    expect(result.bytes.length).toBeGreaterThan(24);
  });

  it('rejects spoofed MIME types, malformed data, and oversized dimensions', () => {
    expect(() => readRasterInfo(`data:image/jpeg;base64,${tinyPng}`)).toThrow('does not match its JPEG type');
    expect(() => readRasterInfo('data:image/png;base64,AAAA')).toThrow();
    const bytes = readRasterInfo(tinyPngUrl).bytes;
    new DataView(bytes.buffer).setUint32(16, 13_000);
    let binary = '';
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    expect(() => readRasterInfo(`data:image/png;base64,${btoa(binary)}`)).toThrow('limited');
  });
});
