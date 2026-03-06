import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FastifyReply, FastifyRequest } from 'fastify';

import { ApiKeyGuard } from '@shared/guards/api-key.guard';
import { Public } from '@shared/guards/public.decorator';

import { UploadImageUseCase } from '@application/image/use-cases/upload-image.use-case';
import { ServeImageUseCase } from '@application/image/use-cases/serve-image.use-case';
import { ListImagesUseCase } from '@application/image/use-cases/list-images.use-case';
import { DeleteImageUseCase } from '@application/image/use-cases/delete-image.use-case';
import { DeleteProductImagesUseCase } from '@application/image/use-cases/delete-product-images.use-case';

import { ImageValidationPipe } from './pipes/image-validation.pipe';
import { unwrapResult } from '../helpers/result-to-response.helper';
import { type UploadImageInput } from '@application/image/use-cases/upload-image.use-case';

@ApiTags('Product Images')
@Controller('products')
@UseGuards(ApiKeyGuard)
export class ImageController {
  constructor(
    private readonly uploadUseCase: UploadImageUseCase,
    private readonly serveUseCase: ServeImageUseCase,
    private readonly listUseCase: ListImagesUseCase,
    private readonly deleteUseCase: DeleteImageUseCase,
    private readonly deleteProductUseCase: DeleteProductImagesUseCase,
  ) {}

  @Post(':productId/images')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload an image for a product' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'productId', type: 'string', format: 'uuid' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Image uploaded successfully' })
  @ApiResponse({ status: 409, description: 'Image limit reached for this product' })
  @ApiResponse({ status: 413, description: 'File too large' })
  @ApiResponse({ status: 415, description: 'Unsupported MIME type' })
  async upload(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Req(new ImageValidationPipe()) file: UploadImageInput['file'],
  ) {
    return unwrapResult(await this.uploadUseCase.execute({ productId, file }));
  }

  @Get(':productId/images')
  @Public()
  @ApiOperation({ summary: 'List all image IDs for a product' })
  @ApiParam({ name: 'productId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Array of image IDs' })
  async list(@Param('productId', ParseUUIDPipe) productId: string) {
    return unwrapResult(await this.listUseCase.execute({ productId }));
  }

  @Get(':productId/images/:imageId')
  @Public()
  @ApiOperation({ summary: 'Serve an image binary' })
  @ApiParam({ name: 'productId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'imageId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Image binary' })
  @ApiResponse({ status: 404, description: 'Image not found' })
  async serve(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
    @Res() reply: FastifyReply,
  ) {
    const { buffer, mimeType } = unwrapResult(
      await this.serveUseCase.execute({ productId, imageId }),
    );

    reply
      .header('Content-Type', mimeType)
      .header('Cache-Control', 'public, max-age=31536000, immutable')
      .header('ETag', `"${imageId}"`)
      .header('Content-Disposition', 'inline')
      .send(buffer);
  }

  @Delete(':productId/images/:imageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a single image' })
  @ApiParam({ name: 'productId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'imageId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Image deleted' })
  @ApiResponse({ status: 404, description: 'Image not found' })
  async deleteOne(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ) {
    unwrapResult(await this.deleteUseCase.execute({ productId, imageId }));
  }

  @Delete(':productId/images')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete all images for a product' })
  @ApiParam({ name: 'productId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'All images deleted' })
  async deleteAll(@Param('productId', ParseUUIDPipe) productId: string) {
    unwrapResult(await this.deleteProductUseCase.execute({ productId }));
  }
}
