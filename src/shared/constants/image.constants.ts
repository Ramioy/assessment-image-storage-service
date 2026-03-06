export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

// Resolved at runtime from the MAX_FILE_SIZE_MB env var; this constant is the fallback default.
export const DEFAULT_MAX_FILE_SIZE_MB = 10;
export const BYTES_PER_MB = 1024 * 1024;
export const DEFAULT_MAX_FILE_SIZE_BYTES = DEFAULT_MAX_FILE_SIZE_MB * BYTES_PER_MB;

export const DEFAULT_MAX_IMAGES_PER_PRODUCT = 20;

export const HEALTH_CHECK_FILE = '.health-check';

export const MIME_TO_EXTENSION: Record<AllowedMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};
