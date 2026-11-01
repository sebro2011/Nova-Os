const MAX_WALLPAPER_DIMENSION = 2560;

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
