import { Injectable, Inject } from '@nestjs/common';

import { ok, type Result } from '@shared/result';
import { DI_TOKENS } from '@shared/di-tokens';

import { type ImageError } from '@domain/image/errors';

import { type StoragePort } from '@application/image/ports/storage.port';

export interface DeleteProductImagesInput {
  productId: string;
}

@Injectable()
export class DeleteProductImagesUseCase {
  constructor(
    @Inject(DI_TOKENS.STORAGE_PORT)
    private readonly storage: StoragePort,
  ) {}

  async execute(dto: DeleteProductImagesInput): Promise<Result<void, ImageError>> {
    const deleteResult = await this.storage.deleteDirectory(dto.productId);
    if (!deleteResult.ok) return deleteResult;

    return ok(undefined);
  }
}
