// @ts-nocheck
/* eslint-disable */

import { ServeImageUseCase } from '@application/image/use-cases/serve-image.use-case';
import { ImageNotFoundError } from '@domain/image/errors/image-not-found.error';
import { StorageOperationFailedError } from '@domain/image/errors/storage-operation-failed.error';
import { ok, err } from '@shared/result';
import {
  makeStoragePortMock,
  makeBuffer,
  PRODUCT_UUID,
  IMAGE_UUID,
} from '../../../../helpers/image.helper';

describe('ServeImageUseCase', () => {
  let useCase: ServeImageUseCase;
  let storage: ReturnType<typeof makeStoragePortMock>;

  const input = { productId: PRODUCT_UUID, imageId: IMAGE_UUID };

  beforeEach(() => {
    storage = makeStoragePortMock();
    useCase = new ServeImageUseCase(storage);
  });

  describe('execute()', () => {
    it('should return ok with buffer and mimeType for a jpg file', async () => {
      const buf = makeBuffer();
      storage.list.mockResolvedValue(ok([`${IMAGE_UUID}.jpg`]));
      storage.read.mockResolvedValue(ok(buf));

      const result = await useCase.execute(input);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.buffer).toBe(buf);
        expect(result.value.mimeType).toBe('image/jpeg');
      }
    });

    it('should resolve the correct MIME type for each extension', async () => {
      const cases = [
        ['jpg', 'image/jpeg'],
        ['jpeg', 'image/jpeg'],
        ['png', 'image/png'],
        ['webp', 'image/webp'],
        ['gif', 'image/gif'],
      ];

      for (const [ext, expectedMime] of cases) {
        storage.list.mockResolvedValue(ok([`${IMAGE_UUID}.${ext}`]));
        storage.read.mockResolvedValue(ok(makeBuffer()));

        const result = await useCase.execute(input);

        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value.mimeType).toBe(expectedMime);
      }
    });

    it('should fall back to application/octet-stream for unknown extension', async () => {
      storage.list.mockResolvedValue(ok([`${IMAGE_UUID}.bin`]));
      storage.read.mockResolvedValue(ok(makeBuffer()));

      const result = await useCase.execute(input);

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.mimeType).toBe('application/octet-stream');
    });

    it('should return err(ImageNotFoundError) when file is not in the listing', async () => {
      storage.list.mockResolvedValue(ok(['other-uuid.jpg']));

      const result = await useCase.execute(input);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(ImageNotFoundError);
        expect(result.error.imageId).toBe(IMAGE_UUID);
      }
    });

    it('should return err(ImageNotFoundError) when directory is empty', async () => {
      storage.list.mockResolvedValue(ok([]));

      const result = await useCase.execute(input);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBeInstanceOf(ImageNotFoundError);
    });

    it('should propagate err(StorageOperationFailedError) when list fails', async () => {
      const storageErr = new StorageOperationFailedError('list', PRODUCT_UUID);
      storage.list.mockResolvedValue(err(storageErr));

      const result = await useCase.execute(input);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe(storageErr);
      expect(storage.read).not.toHaveBeenCalled();
    });

    it('should propagate err(StorageOperationFailedError) when read fails', async () => {
      const storageErr = new StorageOperationFailedError('read', `${PRODUCT_UUID}/${IMAGE_UUID}.jpg`);
      storage.list.mockResolvedValue(ok([`${IMAGE_UUID}.jpg`]));
      storage.read.mockResolvedValue(err(storageErr));

      const result = await useCase.execute(input);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe(storageErr);
    });

    it('should read from the correct relative path', async () => {
      storage.list.mockResolvedValue(ok([`${IMAGE_UUID}.png`]));
      storage.read.mockResolvedValue(ok(makeBuffer()));

      await useCase.execute(input);

      expect(storage.read).toHaveBeenCalledWith(`${PRODUCT_UUID}/${IMAGE_UUID}.png`);
    });
  });
});
