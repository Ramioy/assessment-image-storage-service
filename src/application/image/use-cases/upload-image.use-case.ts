import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import { v4 as generateUuid } from 'uuid';

import { err, ok, fromPromise, type Result } from '@shared/result';
import { DI_TOKENS } from '@shared/di-tokens';
import {
  ALLOWED_MIME_TYPES,
  BYTES_PER_MB,
  DEFAULT_MAX_FILE_SIZE_MB,
  DEFAULT_MAX_IMAGES_PER_PRODUCT,
  MIME_TO_EXTENSION,
  type AllowedMimeType,
} from '@shared/constants/image.constants';

import { ImageFile, type ImageFileDto } from '@domain/image/image-file.value-object';
import { type ImageError } from '@domain/image/errors';
import { UnsupportedMimeTypeError } from '@domain/image/errors/unsupported-mime-type.error';
import { ImageTooLargeError } from '@domain/image/errors/image-too-large.error';
import { ImagesLimitExceededError } from '@domain/image/errors/images-limit-exceeded.error';
import { StorageOperationFailedError } from '@domain/image/errors/storage-operation-failed.error';

import { type StoragePort } from '@application/image/ports/storage.port';

export interface UploadImageInput {
  productId: string;
  file: {
    buffer: Buffer;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
  };
}

@Injectable()
export class UploadImageUseCase {
  constructor(
    @Inject(DI_TOKENS.STORAGE_PORT)
    private readonly storage: StoragePort,
    private readonly configService: ConfigService,
  ) {}

  async execute(dto: UploadImageInput): Promise<Result<ImageFileDto, ImageError>> {
    const maxBytes =
      this.configService.get<number>('MAX_FILE_SIZE_MB', DEFAULT_MAX_FILE_SIZE_MB) * BYTES_PER_MB;
    const maxImages = this.configService.get<number>(
      'MAX_IMAGES_PER_PRODUCT',
      DEFAULT_MAX_IMAGES_PER_PRODUCT,
    );

    // Step 1: Validate MIME type
    const allowedMimes: readonly string[] = ALLOWED_MIME_TYPES;
    if (!allowedMimes.includes(dto.file.mimeType)) {
      return err(new UnsupportedMimeTypeError(dto.file.mimeType));
    }

    // Step 2: Validate file size
    if (dto.file.sizeBytes > maxBytes) {
      return err(new ImageTooLargeError(dto.file.sizeBytes, maxBytes));
    }

    // Step 3: Check image count limit
    const listResult = await this.storage.list(dto.productId);
    if (!listResult.ok) return listResult;
    if (listResult.value.length >= maxImages) {
      return err(new ImagesLimitExceededError(dto.productId, maxImages));
    }

    // Step 4: Validate binary is a real image
    const sharpResult = await this.validateImageBinary(dto.file.buffer, dto.file.originalName);
    if (!sharpResult.ok) return sharpResult;

    // Step 5: Build value object
    const imageId = generateUuid();
    // safe cast: MIME type already validated against ALLOWED_MIME_TYPES in step 1
    const extension = MIME_TO_EXTENSION[dto.file.mimeType as AllowedMimeType];
    const storagePath = `${dto.productId}/${imageId}.${extension}`;

    const imageFileResult = ImageFile.create(
      {
        id: imageId,
        productId: dto.productId,
        originalName: dto.file.originalName,
        mimeType: dto.file.mimeType,
        sizeBytes: dto.file.sizeBytes,
        storagePath,
      },
      maxBytes,
    );
    if (!imageFileResult.ok) return imageFileResult;

    // Step 6: Write to volume
    const writeResult = await this.storage.write(storagePath, dto.file.buffer);
    if (!writeResult.ok) return writeResult;

    // Step 7: Return DTO
    return ok(imageFileResult.value.toDto());
  }

  private async validateImageBinary(
    buffer: Buffer,
    originalName: string,
  ): Promise<Result<undefined, StorageOperationFailedError>> {
    return fromPromise(
      sharp(buffer)
        .metadata()
        .then(() => undefined),
      () => new StorageOperationFailedError('process', originalName),
    );
  }
}
