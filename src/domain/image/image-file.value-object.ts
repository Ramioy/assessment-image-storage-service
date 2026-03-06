import { z } from 'zod';

import { err, ok, type Result } from '@shared/result';
import { ALLOWED_MIME_TYPES } from '@shared/constants/image.constants';

import { ImageTooLargeError } from './errors/image-too-large.error';
import { UnsupportedMimeTypeError } from './errors/unsupported-mime-type.error';

// ── Zod schemas ───────────────────────────────────────────────────────────────

export const imageFileSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  originalName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(100),
  sizeBytes: z.number().int().positive(),
  storagePath: z.string().min(1).max(512),
});

export const createImageFileSchema = imageFileSchema;

export type ImageFileDto = z.infer<typeof imageFileSchema>;
export type CreateImageFileDto = z.infer<typeof createImageFileSchema>;

// ── Value object ──────────────────────────────────────────────────────────────

export class ImageFile {
  private constructor(
    readonly id: string,
    readonly productId: string,
    readonly originalName: string,
    readonly mimeType: string,
    readonly sizeBytes: number,
    readonly storagePath: string,
  ) {}

  static create(
    dto: CreateImageFileDto,
    maxBytes: number,
  ): Result<ImageFile, ImageTooLargeError | UnsupportedMimeTypeError> {
    const allowedMimes: readonly string[] = ALLOWED_MIME_TYPES;

    if (!allowedMimes.includes(dto.mimeType)) {
      return err(new UnsupportedMimeTypeError(dto.mimeType));
    }

    if (dto.sizeBytes > maxBytes) {
      return err(new ImageTooLargeError(dto.sizeBytes, maxBytes));
    }

    return ok(
      new ImageFile(
        dto.id,
        dto.productId,
        dto.originalName,
        dto.mimeType,
        dto.sizeBytes,
        dto.storagePath,
      ),
    );
  }

  toDto(): ImageFileDto {
    return imageFileSchema.parse({
      id: this.id,
      productId: this.productId,
      originalName: this.originalName,
      mimeType: this.mimeType,
      sizeBytes: this.sizeBytes,
      storagePath: this.storagePath,
    });
  }
}
