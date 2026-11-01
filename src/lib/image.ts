const MAX_WALLPAPER_DIMENSION = 2560;

export function sanitizeRasterDataUrl(value: unknown): string | null {
  return typeof value === 'string' && value.length <= 120_000 && /^data:image\/(?:png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)
    ? value
    : null;
}

/** Decodes and re-encodes a small raster icon, rejecting SVG and other active formats. */
export async function createRasterIconDataUrl(file: File, dimension: number): Promise<string> {
  if (!['image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a PNG or WebP image. SVG and other formats are not accepted.');
  if (file.size > 512 * 1024) throw new Error('Icon images are limited to 512 KB.');
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width < 8 || bitmap.height < 8 || bitmap.width * bitmap.height > 16_000_000) {
      throw new Error('Choose an icon between 8 pixels and 16 megapixels.');
    }
    const size = Math.max(16, Math.min(128, Math.round(dimension)));
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This browser cannot process image icons.');
    const scale = Math.min(size / bitmap.width, size / bitmap.height);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    context.drawImage(bitmap, (size - width) / 2, (size - height) / 2, width, height);
    return canvas.toDataURL('image/png');
  } finally {
    bitmap.close();
  }
}

/** Limits stored wallpaper dimensions and uses WebP when it meaningfully reduces size. */
export async function optimizeWallpaper(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 40_000_000) {
      throw new Error('Image dimensions are too large. Choose an image under 40 megapixels.');
    }
    const scale = Math.min(1, MAX_WALLPAPER_DIMENSION / bitmap.width, MAX_WALLPAPER_DIMENSION / bitmap.height);
    if (scale === 1 && file.size <= 2 * 1024 * 1024) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const optimized = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.86));
    return optimized && optimized.size < file.size ? optimized : file;
  } finally {
    bitmap.close();
  }
}
