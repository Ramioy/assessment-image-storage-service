import {
  BadRequestException,
  Injectable,
  PipeTransform,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import type { MultipartFile } from '@fastify/multipart';
import { FastifyRequest } from 'fastify';

import { ALLOWED_MIME_TYPES } from '@shared/constants/image.constants';
import { type UploadImageInput } from '@application/image/use-cases/upload-image.use-case';

@Injectable()
export class ImageValidationPipe
  implements PipeTransform<FastifyRequest, Promise<UploadImageInput['file']>>
{
  async transform(request: FastifyRequest): Promise<UploadImageInput['file']> {
    let data: MultipartFile | undefined;

    try {
      data = await request.file();
    } catch {
      throw new BadRequestException('Failed to parse multipart request');
    }

    if (!data) {
      throw new BadRequestException('No file field found in the request');
    }

    const allowedMimes: readonly string[] = ALLOWED_MIME_TYPES;
    if (!allowedMimes.includes(data.mimetype)) {
      throw new UnsupportedMediaTypeException(
        `MIME type "${data.mimetype}" is not supported. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}.`,
      );
    }

    let buffer: Buffer;
    try {
      buffer = await data.toBuffer();
    } catch {
      throw new BadRequestException('Failed to read file buffer');
    }

    return {
      buffer,
      originalName: data.filename,
      mimeType: data.mimetype,
      sizeBytes: buffer.length,
    };
  }
}
