import { MAX_OFFICE_IMAGE_CHARS } from './constants';
import { readRasterInfo } from './raster';

export function officeRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

export function officeText(value: unknown, label: string, maxLength: number, allowEmpty = true): string {
  if (typeof value !== 'string' || value.length > maxLength || (!allowEmpty && !value.trim()) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) {
    throw new Error(`${label} is invalid or exceeds ${maxLength} characters.`);
  }
  return value;
}

export function officeId(value: unknown, label = 'ID'): string {
  const id = officeText(value, label, 140, false);
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error(`${label} contains unsupported characters.`);
  return id;
}

export function officeNumber(value: unknown, label: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`${label} must be between ${min} and ${max}.`);
  return value;
}

export function officeColor(value: unknown, label = 'Color'): string {
  if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`${label} must be a six-digit hex color.`);
  return value.toLowerCase();
}

export function officeImage(value: unknown, label = 'Image'): string {
  const image = officeText(value, label, MAX_OFFICE_IMAGE_CHARS, false);
  if (!/^data:image\/(?:png|jpeg|webp);base64,[a-z\d+/]+={0,2}$/i.test(image)) {
    throw new Error(`${label} must be a bounded PNG, JPEG, or WebP raster data URL.`);
  }
  readRasterInfo(image);
  return image;
}

export function officeLink(value: unknown): string {
  const href = officeText(value, 'Link URL', 2_000, false);
  const parsed = new URL(href);
  if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error('Links allow only safe HTTP, HTTPS, and email addresses without credentials.');
  }
  return parsed.toString();
}

export function officeArray(value: unknown, label: string, maxLength: number): unknown[] {
  if (!Array.isArray(value) || value.length > maxLength) throw new Error(`${label} must be an array with at most ${maxLength} items.`);
  return value;
}
