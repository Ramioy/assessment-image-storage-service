// @ts-nocheck
/* eslint-disable */

import { ListImagesUseCase } from '@application/image/use-cases/list-images.use-case';
import { StorageOperationFailedError } from '@domain/image/errors/storage-operation-failed.error';
import { ok, err } from '@shared/result';
import { makeStoragePortMock, PRODUCT_UUID, IMAGE_UUID } from '../../../../helpers/image.helper';

describe('ListImagesUseCase', () => {
  let useCase: ListImagesUseCase;
  let storage: ReturnType<typeof makeStoragePortMock>;

  const input = { productId: PRODUCT_UUID };

  beforeEach(() => {
    storage = makeStoragePortMock();
    useCase = new ListImagesUseCase(storage);
  });

  describe('execute()', () => {
    it('should return ok with image IDs stripped of extensions', async () => {
      storage.list.mockResolvedValue(ok([`${IMAGE_UUID}.jpg`, 'other-uuid.png']));

      const result = await useCase.execute(input);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual([IMAGE_UUID, 'other-uuid']);
      }
    });

    it('should return ok with an empty array when the product has no images', async () => {
      storage.list.mockResolvedValue(ok([]));

      const result = await useCase.execute(input);

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toEqual([]);
    });

    it('should call storage.list with the productId as the directory path', async () => {
      storage.list.mockResolvedValue(ok([]));

      await useCase.execute(input);

      expect(storage.list).toHaveBeenCalledWith(PRODUCT_UUID);
    });

    it('should propagate err(StorageOperationFailedError) when list fails', async () => {
      const storageErr = new StorageOperationFailedError('list', PRODUCT_UUID);
      storage.list.mockResolvedValue(err(storageErr));

      const result = await useCase.execute(input);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe(storageErr);
    });

    it('should strip the extension correctly for all supported formats', async () => {
      const id1 = 'aaaaaaaa-1111-2222-3333-444444444444';
      const id2 = 'bbbbbbbb-5555-6666-7777-888888888888';
      const id3 = 'cccccccc-9999-aaaa-bbbb-cccccccccccc';
      const id4 = 'dddddddd-eeee-ffff-0000-111122223333';
      storage.list.mockResolvedValue(
        ok([`${id1}.jpg`, `${id2}.png`, `${id3}.webp`, `${id4}.gif`]),
      );

      const result = await useCase.execute(input);

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toEqual([id1, id2, id3, id4]);
    });
  });
});
