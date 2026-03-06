import { basename, extname } from 'node:path';

import { Injectable, Inject } from '@nestjs/common';

import { ok, type Result } from '@shared/result';
import { DI_TOKENS } from '@shared/di-tokens';

import { type ImageError } from '@domain/image/errors';

import { type StoragePort } from '@application/image/ports/storage.port';

export interface ListImagesInput {
  productId: string;
}

@Injectable()
export class ListImagesUseCase {
  constructor(
    @Inject(DI_TOKENS.STORAGE_PORT)
    private readonly storage: StoragePort,
  ) {}

  async execute(dto: ListImagesInput): Promise<Result<string[], ImageError>> {
    // Step 1: List files under the product directory
    const listResult = await this.storage.list(dto.productId);
    if (!listResult.ok) return listResult;

    // Step 2: Strip extensions to expose image IDs only
    const imageIds = listResult.value.map((filename) => basename(filename, extname(filename)));

    return ok(imageIds);
  }
}
