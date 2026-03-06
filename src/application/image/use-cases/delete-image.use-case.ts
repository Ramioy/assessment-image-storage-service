import { Injectable, Inject } from '@nestjs/common';

import { err, ok, type Result } from '@shared/result';
import { DI_TOKENS } from '@shared/di-tokens';

import { type ImageError } from '@domain/image/errors';
import { ImageNotFoundError } from '@domain/image/errors/image-not-found.error';

import { type StoragePort } from '@application/image/ports/storage.port';

export interface DeleteImageInput {
  productId: string;
  imageId: string;
}

@Injectable()
export class DeleteImageUseCase {
  constructor(
    @Inject(DI_TOKENS.STORAGE_PORT)
    private readonly storage: StoragePort,
  ) {}

  async execute(dto: DeleteImageInput): Promise<Result<void, ImageError>> {
    // Step 1: List files to locate "<imageId>.*"
    const listResult = await this.storage.list(dto.productId);
    if (!listResult.ok) return listResult;

    const filename = listResult.value.find((f) => f.startsWith(`${dto.imageId}.`));
    if (!filename) {
      return err(new ImageNotFoundError(dto.productId, dto.imageId));
    }

    // Step 2: Delete the file
    const relativePath = `${dto.productId}/${filename}`;
    const deleteResult = await this.storage.delete(relativePath);
    if (!deleteResult.ok) return deleteResult;

    return ok(undefined);
  }
}
