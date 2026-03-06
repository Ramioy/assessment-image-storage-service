import { extname } from 'node:path';

import { Injectable, Inject } from '@nestjs/common';

import { err, ok, type Result } from '@shared/result';
import { DI_TOKENS } from '@shared/di-tokens';

import { type ImageError } from '@domain/image/errors';
import { ImageNotFoundError } from '@domain/image/errors/image-not-found.error';

import { type StoragePort } from '@application/image/ports/storage.port';

const EXTENSION_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

export interface ServeImageInput {
  productId: string;
  imageId: string;
}

export interface ServeImageOutput {
  buffer: Buffer;
  mimeType: string;
}

@Injectable()
export class ServeImageUseCase {
  constructor(
    @Inject(DI_TOKENS.STORAGE_PORT)
    private readonly storage: StoragePort,
  ) {}

  async execute(dto: ServeImageInput): Promise<Result<ServeImageOutput, ImageError>> {
    // Step 1: List files to locate "<imageId>.*"
    const listResult = await this.storage.list(dto.productId);
    if (!listResult.ok) return listResult;

    const filename = listResult.value.find((f) => f.startsWith(`${dto.imageId}.`));
    if (!filename) {
      return err(new ImageNotFoundError(dto.productId, dto.imageId));
    }

    // Step 2: Read binary from volume
    const relativePath = `${dto.productId}/${filename}`;
    const readResult = await this.storage.read(relativePath);
    if (!readResult.ok) return readResult;

    // Step 3: Derive MIME type from extension
    const ext = extname(filename).slice(1).toLowerCase();
    const mimeType = EXTENSION_TO_MIME[ext] ?? 'application/octet-stream';

    return ok({ buffer: readResult.value, mimeType });
  }
}
