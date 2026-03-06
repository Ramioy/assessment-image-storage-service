// @ts-nocheck
/* eslint-disable */

import { BadRequestException, UnsupportedMediaTypeException } from '@nestjs/common';
import { ImageValidationPipe } from '@presentation/image/pipes/image-validation.pipe';
import { makeBuffer } from '../../../helpers/image.helper';

function makeMultipartFile(overrides = {}) {
  const buf = makeBuffer();
  return {
    filename: 'photo.jpg',
    mimetype: 'image/jpeg',
    toBuffer: jest.fn().mockResolvedValue(buf),
    ...overrides,
  };
}

function makeRequest(fileData = undefined) {
  return {
    file: jest.fn().mockResolvedValue(fileData),
  };
}

describe('ImageValidationPipe', () => {
  let pipe: ImageValidationPipe;

  beforeEach(() => {
    pipe = new ImageValidationPipe();
  });

  describe('transform()', () => {
    it('should return file data for a valid jpeg upload', async () => {
      const multipartFile = makeMultipartFile();
      const request = makeRequest(multipartFile);

      const result = await pipe.transform(request as any);

      expect(result.originalName).toBe('photo.jpg');
      expect(result.mimeType).toBe('image/jpeg');
      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.sizeBytes).toBe(result.buffer.length);
    });

    it('should return file data for all allowed MIME types', async () => {
      const mimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

      for (const mimetype of mimes) {
        const request = makeRequest(makeMultipartFile({ mimetype }));
        const result = await pipe.transform(request as any);
        expect(result.mimeType).toBe(mimetype);
      }
    });

    it('should throw BadRequestException when no file is present in the request', async () => {
      const request = makeRequest(undefined);

      await expect(pipe.transform(request as any)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should throw UnsupportedMediaTypeException for a disallowed MIME type', async () => {
      const multipartFile = makeMultipartFile({ mimetype: 'application/pdf' });
      const request = makeRequest(multipartFile);

      await expect(pipe.transform(request as any)).rejects.toBeInstanceOf(
        UnsupportedMediaTypeException,
      );
    });

    it('should throw BadRequestException when request.file() rejects', async () => {
      const request = {
        file: jest.fn().mockRejectedValue(new Error('multipart parse error')),
      };

      await expect(pipe.transform(request as any)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should throw BadRequestException when toBuffer() rejects', async () => {
      const multipartFile = makeMultipartFile({
        toBuffer: jest.fn().mockRejectedValue(new Error('stream error')),
      });
      const request = makeRequest(multipartFile);

      await expect(pipe.transform(request as any)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should set sizeBytes equal to the buffer byte length', async () => {
      const buf = Buffer.alloc(512, 0);
      const multipartFile = makeMultipartFile({ toBuffer: jest.fn().mockResolvedValue(buf) });
      const request = makeRequest(multipartFile);

      const result = await pipe.transform(request as any);

      expect(result.sizeBytes).toBe(512);
    });
  });
});
