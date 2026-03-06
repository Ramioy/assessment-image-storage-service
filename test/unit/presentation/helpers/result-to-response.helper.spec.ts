// @ts-nocheck
/* eslint-disable */

import {
  BadGatewayException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ok, err } from '@shared/result';
import { unwrapResult } from '@presentation/helpers/result-to-response.helper';
import { ImageNotFoundError } from '@domain/image/errors/image-not-found.error';
import { ImageTooLargeError } from '@domain/image/errors/image-too-large.error';
import { UnsupportedMimeTypeError } from '@domain/image/errors/unsupported-mime-type.error';
import { ImagesLimitExceededError } from '@domain/image/errors/images-limit-exceeded.error';
import { StorageOperationFailedError } from '@domain/image/errors/storage-operation-failed.error';
import { PRODUCT_UUID, IMAGE_UUID } from '../../../helpers/image.helper';

describe('unwrapResult()', () => {
  it('should return the value when result is ok', () => {
    const value = { id: IMAGE_UUID };
    expect(unwrapResult(ok(value))).toBe(value);
  });

  it('should throw NotFoundException for ImageNotFoundError', () => {
    const error = new ImageNotFoundError(PRODUCT_UUID, IMAGE_UUID);
    expect(() => unwrapResult(err(error))).toThrow(NotFoundException);
  });

  it('should throw PayloadTooLargeException for ImageTooLargeError', () => {
    const error = new ImageTooLargeError(11 * 1024 * 1024, 10 * 1024 * 1024);
    expect(() => unwrapResult(err(error))).toThrow(PayloadTooLargeException);
  });

  it('should throw UnsupportedMediaTypeException for UnsupportedMimeTypeError', () => {
    const error = new UnsupportedMimeTypeError('application/pdf');
    expect(() => unwrapResult(err(error))).toThrow(UnsupportedMediaTypeException);
  });

  it('should throw ConflictException for ImagesLimitExceededError', () => {
    const error = new ImagesLimitExceededError(PRODUCT_UUID, 20);
    expect(() => unwrapResult(err(error))).toThrow(ConflictException);
  });

  it('should throw BadGatewayException for StorageOperationFailedError', () => {
    const error = new StorageOperationFailedError('write', 'some/path.jpg');
    expect(() => unwrapResult(err(error))).toThrow(BadGatewayException);
  });

  it('should throw InternalServerErrorException for an unknown error type', () => {
    // Cast to bypass TypeScript — simulates an unrecognised error at runtime
    const unknown = { code: 'UNKNOWN', message: 'unexpected' } as any;
    expect(() => unwrapResult(err(unknown))).toThrow(InternalServerErrorException);
  });
});
