export interface RasterInfo {
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  width: number;
  height: number;
  bytes: Uint8Array;
}

export const MAX_RASTER_PIXELS = 20_000_000;
export const MAX_RASTER_DIMENSION = 12_000;

function decodeBase64(value: string): Uint8Array {
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  } catch {
    throw new Error('The raster image contains invalid base64 data.');
  }
}

function boundedDimensions(width: number, height: number): { width: number; height: number } {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > MAX_RASTER_DIMENSION || height > MAX_RASTER_DIMENSION || width * height > MAX_RASTER_PIXELS) {
    throw new Error('Raster images are limited to 12,000 pixels per side and 20 million total pixels.');
  }
  return { width, height };
}

function pngDimensions(bytes: Uint8Array): { width: number; height: number } {
  if (bytes.length < 24) throw new Error('The PNG image is incomplete.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return boundedDimensions(view.getUint32(16), view.getUint32(20));
}

function jpegDimensions(bytes: Uint8Array): { width: number; height: number } {
  let offset = 2;
  while (offset + 9 < bytes.length && offset < 1_000_000) {
    if (bytes[offset] !== 0xff) { offset += 1; continue; }
    const marker = bytes[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) break;
    const length = (bytes[offset] << 8) | bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length) break;
    const isStartOfFrame = (marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf);
    if (isStartOfFrame && length >= 7) {
      return boundedDimensions((bytes[offset + 5] << 8) | bytes[offset + 6], (bytes[offset + 3] << 8) | bytes[offset + 4]);
    }
    offset += length;
  }
  throw new Error('The JPEG image has no valid dimensions.');
}

function webpDimensions(bytes: Uint8Array): { width: number; height: number } {
  if (bytes.length < 30) throw new Error('The WebP image is incomplete.');
  const chunk = String.fromCharCode(...bytes.subarray(12, 16));
  if (chunk === 'VP8X') {
    const width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
    const height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
    return boundedDimensions(width, height);
  }
  if (chunk === 'VP8 ' && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
    return boundedDimensions((bytes[26] | (bytes[27] << 8)) & 0x3fff, (bytes[28] | (bytes[29] << 8)) & 0x3fff);
  }
  if (chunk === 'VP8L' && bytes[20] === 0x2f) {
    const width = 1 + bytes[21] + ((bytes[22] & 0x3f) << 8);
    const height = 1 + ((bytes[22] & 0xc0) >> 6) + (bytes[23] << 2) + ((bytes[24] & 0x0f) << 10);
    return boundedDimensions(width, height);
  }
  throw new Error('The WebP image has no supported dimensions.');
}

export function readRasterInfo(dataUrl: string): RasterInfo {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([a-z\d+/]+={0,2})$/i.exec(dataUrl);
  if (!match) throw new Error('Image must be a PNG, JPEG, or WebP base64 data URL.');
  const mimeType = match[1].toLowerCase() as RasterInfo['mimeType'];
  const bytes = decodeBase64(match[2]);
  if (mimeType === 'image/png') {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    if (!signature.every((byte, index) => bytes[index] === byte)) throw new Error('The image data does not match its PNG type.');
    return { mimeType, bytes, ...pngDimensions(bytes) };
  }
  if (mimeType === 'image/jpeg') {
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('The image data does not match its JPEG type.');
    return { mimeType, bytes, ...jpegDimensions(bytes) };
  }
  if (String.fromCharCode(...bytes.subarray(0, 4)) !== 'RIFF' || String.fromCharCode(...bytes.subarray(8, 12)) !== 'WEBP') throw new Error('The image data does not match its WebP type.');
  return { mimeType, bytes, ...webpDimensions(bytes) };
}
