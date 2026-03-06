import { Module } from '@nestjs/common';

import { UploadImageUseCase } from '@application/image/use-cases/upload-image.use-case';
import { ServeImageUseCase } from '@application/image/use-cases/serve-image.use-case';
import { ListImagesUseCase } from '@application/image/use-cases/list-images.use-case';
import { DeleteImageUseCase } from '@application/image/use-cases/delete-image.use-case';
import { DeleteProductImagesUseCase } from '@application/image/use-cases/delete-product-images.use-case';

import { ImageController } from '@presentation/image/image.controller';

import { StorageModule } from './storage.module';

@Module({
  imports: [StorageModule],
  controllers: [ImageController],
  providers: [
    UploadImageUseCase,
    ServeImageUseCase,
    ListImagesUseCase,
    DeleteImageUseCase,
    DeleteProductImagesUseCase,
  ],
})
export class ImageModule {}
