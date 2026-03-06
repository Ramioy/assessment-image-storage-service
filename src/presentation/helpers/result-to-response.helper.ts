import {
  BadGatewayException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';

import { type Result } from '@shared/result';

import { ImageNotFoundError } from '@domain/image/errors/image-not-found.error';
import { ImageTooLargeError } from '@domain/image/errors/image-too-large.error';
import { UnsupportedMimeTypeError } from '@domain/image/errors/unsupported-mime-type.error';
import { ImagesLimitExceededError } from '@domain/image/errors/images-limit-exceeded.error';
import { StorageOperationFailedError } from '@domain/image/errors/storage-operation-failed.error';
import { type ImageError } from '@domain/image/errors';

export function unwrapResult<T>(result: Result<T, ImageError>): T {
  if (result.ok) return result.value;

  const { error } = result;

  if (error instanceof ImageNotFoundError) throw new NotFoundException(error.message);
  if (error instanceof ImageTooLargeError) throw new PayloadTooLargeException(error.message);
  if (error instanceof UnsupportedMimeTypeError)
    throw new UnsupportedMediaTypeException(error.message);
  if (error instanceof ImagesLimitExceededError) throw new ConflictException(error.message);
  if (error instanceof StorageOperationFailedError) throw new BadGatewayException(error.message);

  throw new InternalServerErrorException('Unexpected error');
}
