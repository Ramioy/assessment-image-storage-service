// @ts-nocheck
/* eslint-disable */

import { DeleteProductImagesUseCase } from '@application/image/use-cases/delete-product-images.use-case';
import { StorageOperationFailedError } from '@domain/image/errors/storage-operation-failed.error';
import { ok, err } from '@shared/result';
import { makeStoragePortMock, PRODUCT_UUID } from '../../../../helpers/image.helper';

describe('DeleteProductImagesUseCase', () => {
  let useCase: DeleteProductImagesUseCase;
  let storage: ReturnType<typeof makeStoragePortMock>;

  const input = { productId: PRODUCT_UUID };

  beforeEach(() => {
    storage = makeStoragePortMock();
    useCase = new DeleteProductImagesUseCase(storage);
  });

  describe('execute()', () => {
    it('should return ok and call deleteDirectory with the productId', async () => {
      storage.deleteDirectory.mockResolvedValue(ok(undefined));

      const result = await useCase.execute(input);

      expect(result.ok).toBe(true);
      expect(storage.deleteDirectory).toHaveBeenCalledWith(PRODUCT_UUID);
    });

    it('should propagate err(StorageOperationFailedError) when deleteDirectory fails', async () => {
      const storageErr = new StorageOperationFailedError('deleteDirectory', PRODUCT_UUID);
      storage.deleteDirectory.mockResolvedValue(err(storageErr));

      const result = await useCase.execute(input);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe(storageErr);
    });

    it('should not call any other storage methods', async () => {
      storage.deleteDirectory.mockResolvedValue(ok(undefined));

      await useCase.execute(input);

      expect(storage.list).not.toHaveBeenCalled();
      expect(storage.delete).not.toHaveBeenCalled();
      expect(storage.read).not.toHaveBeenCalled();
      expect(storage.write).not.toHaveBeenCalled();
    });
  });
});
