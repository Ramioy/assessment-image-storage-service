// @ts-nocheck
/* eslint-disable */

import { DeleteImageUseCase } from '@application/image/use-cases/delete-image.use-case';
import { ImageNotFoundError } from '@domain/image/errors/image-not-found.error';
import { StorageOperationFailedError } from '@domain/image/errors/storage-operation-failed.error';
import { ok, err } from '@shared/result';
import { makeStoragePortMock, PRODUCT_UUID, IMAGE_UUID } from '../../../../helpers/image.helper';

describe('DeleteImageUseCase', () => {
  let useCase: DeleteImageUseCase;
  let storage: ReturnType<typeof makeStoragePortMock>;

  const input = { productId: PRODUCT_UUID, imageId: IMAGE_UUID };

  beforeEach(() => {
    storage = makeStoragePortMock();
    useCase = new DeleteImageUseCase(storage);
  });

  describe('execute()', () => {
    it('should return ok and call delete with the correct path', async () => {
      storage.list.mockResolvedValue(ok([`${IMAGE_UUID}.jpg`]));
      storage.delete.mockResolvedValue(ok(undefined));

      const result = await useCase.execute(input);

      expect(result.ok).toBe(true);
      expect(storage.delete).toHaveBeenCalledWith(`${PRODUCT_UUID}/${IMAGE_UUID}.jpg`);
    });

    it('should return err(ImageNotFoundError) when file is not in the listing', async () => {
      storage.list.mockResolvedValue(ok(['some-other-uuid.png']));

      const result = await useCase.execute(input);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(ImageNotFoundError);
        expect(result.error.imageId).toBe(IMAGE_UUID);
        expect(result.error.productId).toBe(PRODUCT_UUID);
      }
      expect(storage.delete).not.toHaveBeenCalled();
    });

    it('should return err(ImageNotFoundError) when product directory is empty', async () => {
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
      expect(storage.delete).not.toHaveBeenCalled();
    });

    it('should propagate err(StorageOperationFailedError) when delete fails', async () => {
      const storageErr = new StorageOperationFailedError('delete', `${PRODUCT_UUID}/${IMAGE_UUID}.png`);
      storage.list.mockResolvedValue(ok([`${IMAGE_UUID}.png`]));
      storage.delete.mockResolvedValue(err(storageErr));

      const result = await useCase.execute(input);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe(storageErr);
    });
  });
});
