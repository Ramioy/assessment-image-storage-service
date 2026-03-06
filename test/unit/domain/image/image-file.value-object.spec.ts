// @ts-nocheck
/* eslint-disable */

import { ImageFile } from '@domain/image/image-file.value-object';
import { ImageTooLargeError } from '@domain/image/errors/image-too-large.error';
import { UnsupportedMimeTypeError } from '@domain/image/errors/unsupported-mime-type.error';
import { makeCreateImageFileDto, makeImageFileDto } from '../../../helpers/image.helper';

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

describe('ImageFile', () => {
  describe('create()', () => {
    it('should return ok with a valid ImageFile for a jpeg input', () => {
      const dto = makeCreateImageFileDto();

      const result = ImageFile.create(dto, MAX_BYTES);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeInstanceOf(ImageFile);
        expect(result.value.id).toBe(dto.id);
        expect(result.value.productId).toBe(dto.productId);
        expect(result.value.mimeType).toBe('image/jpeg');
        expect(result.value.sizeBytes).toBe(dto.sizeBytes);
        expect(result.value.storagePath).toBe(dto.storagePath);
      }
    });

    it('should return ok for all allowed MIME types', () => {
      const mimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

      for (const mimeType of mimes) {
        const dto = makeCreateImageFileDto({ mimeType });
        const result = ImageFile.create(dto, MAX_BYTES);
        expect(result.ok).toBe(true);
      }
    });

    it('should return err(UnsupportedMimeTypeError) for an invalid MIME type', () => {
      const dto = makeCreateImageFileDto({ mimeType: 'application/pdf' });

      const result = ImageFile.create(dto, MAX_BYTES);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(UnsupportedMimeTypeError);
        expect(result.error.code).toBe('UNSUPPORTED_MIME_TYPE');
        expect(result.error.mimeType).toBe('application/pdf');
      }
    });

    it('should return err(ImageTooLargeError) when sizeBytes exceeds maxBytes', () => {
      const maxBytes = 500;
      const dto = makeCreateImageFileDto({ sizeBytes: 501 });

      const result = ImageFile.create(dto, maxBytes);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(ImageTooLargeError);
        expect(result.error.code).toBe('IMAGE_TOO_LARGE');
        expect(result.error.sizeBytes).toBe(501);
        expect(result.error.maxBytes).toBe(500);
      }
    });

    it('should return ok when sizeBytes equals maxBytes exactly', () => {
      const maxBytes = 1024;
      const dto = makeCreateImageFileDto({ sizeBytes: 1024 });

      const result = ImageFile.create(dto, maxBytes);

      expect(result.ok).toBe(true);
    });

    it('should validate MIME type before size so UnsupportedMimeTypeError has priority', () => {
      const dto = makeCreateImageFileDto({ mimeType: 'text/html', sizeBytes: 999999999 });

      const result = ImageFile.create(dto, 1);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(UnsupportedMimeTypeError);
      }
    });
  });

  describe('toDto()', () => {
    it('should return an ImageFileDto matching all fields', () => {
      const dto = makeCreateImageFileDto();
      const imageFile = ImageFile.create(dto, MAX_BYTES);
      if (!imageFile.ok) throw new Error('setup failed');

      const result = imageFile.value.toDto();

      expect(result).toEqual(makeImageFileDto());
    });

    it('should produce a plain object (not an ImageFile instance)', () => {
      const dto = makeCreateImageFileDto();
      const imageFile = ImageFile.create(dto, MAX_BYTES);
      if (!imageFile.ok) throw new Error('setup failed');

      const result = imageFile.value.toDto();

      expect(result).not.toBeInstanceOf(ImageFile);
      expect(typeof result).toBe('object');
    });
  });
});
