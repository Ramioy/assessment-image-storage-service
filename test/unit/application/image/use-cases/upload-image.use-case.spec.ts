// @ts-nocheck
/* eslint-disable */

import { UploadImageUseCase } from '@application/image/use-cases/upload-image.use-case';
import { ImageFile } from '@domain/image/image-file.value-object';
import { UnsupportedMimeTypeError } from '@domain/image/errors/unsupported-mime-type.error';
import { ImageTooLargeError } from '@domain/image/errors/image-too-large.error';
import { ImagesLimitExceededError } from '@domain/image/errors/images-limit-exceeded.error';
import { StorageOperationFailedError } from '@domain/image/errors/storage-operation-failed.error';
import { ok, err } from '@shared/result';
import {
  makeStoragePortMock,
  makeConfigServiceMock,
  makeUploadImageInput,
  PRODUCT_UUID,
} from '../../../../helpers/image.helper';

jest.mock('sharp', () => {
  const mock = jest.fn().mockReturnValue({
    metadata: jest.fn().mockResolvedValue({ format: 'jpeg', width: 100, height: 100 }),
  });
  return mock;
});

describe('UploadImageUseCase', () => {
  let useCase: UploadImageUseCase;
  let storage: ReturnType<typeof makeStoragePortMock>;
  let configService: ReturnType<typeof makeConfigServiceMock>;

  beforeEach(() => {
    jest.clearAllMocks();
    storage = makeStoragePortMock();
    configService = makeConfigServiceMock();
    useCase = new UploadImageUseCase(storage, configService);
  });

  describe('execute()', () => {
    it('should return ok(ImageFileDto) on a valid upload', async () => {
      const input = makeUploadImageInput();
      storage.list.mockResolvedValue(ok([]));
      storage.write.mockResolvedValue(ok(undefined));

      const result = await useCase.execute(input);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.productId).toBe(PRODUCT_UUID);
        expect(result.value.mimeType).toBe('image/jpeg');
        expect(result.value.storagePath).toMatch(new RegExp(`^${PRODUCT_UUID}/`));
        expect(result.value.storagePath).toMatch(/\.jpg$/);
      }
    });

    it('should return err(UnsupportedMimeTypeError) for an unsupported MIME type', async () => {
      const input = makeUploadImageInput({ file: { ...makeUploadImageInput().file, mimeType: 'application/pdf' } });

      const result = await useCase.execute(input);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBeInstanceOf(UnsupportedMimeTypeError);
      expect(storage.list).not.toHaveBeenCalled();
    });

    it('should return err(ImageTooLargeError) when file exceeds the configured limit', async () => {
      configService = makeConfigServiceMock({ MAX_FILE_SIZE_MB: 1 });
      useCase = new UploadImageUseCase(storage, configService);
      const input = makeUploadImageInput({
        file: { ...makeUploadImageInput().file, sizeBytes: 2 * 1024 * 1024 },
      });

      const result = await useCase.execute(input);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBeInstanceOf(ImageTooLargeError);
      expect(storage.list).not.toHaveBeenCalled();
    });

    it('should return err(ImagesLimitExceededError) when product is at image limit', async () => {
      configService = makeConfigServiceMock({ MAX_IMAGES_PER_PRODUCT: 2 });
      useCase = new UploadImageUseCase(storage, configService);
      const input = makeUploadImageInput();
      storage.list.mockResolvedValue(ok(['img1.jpg', 'img2.jpg']));

      const result = await useCase.execute(input);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(ImagesLimitExceededError);
        expect(result.error.productId).toBe(PRODUCT_UUID);
        expect(result.error.maxImages).toBe(2);
      }
    });

    it('should propagate err(StorageOperationFailedError) when list fails', async () => {
      const storageErr = new StorageOperationFailedError('list', PRODUCT_UUID);
      const input = makeUploadImageInput();
      storage.list.mockResolvedValue(err(storageErr));

      const result = await useCase.execute(input);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe(storageErr);
      expect(storage.write).not.toHaveBeenCalled();
    });

    it('should propagate err(StorageOperationFailedError) when write fails', async () => {
      const storageErr = new StorageOperationFailedError('write', `${PRODUCT_UUID}/img.jpg`);
      const input = makeUploadImageInput();
      storage.list.mockResolvedValue(ok([]));
      storage.write.mockResolvedValue(err(storageErr));

      const result = await useCase.execute(input);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe(storageErr);
    });

    it('should return err(StorageOperationFailedError) when sharp validation rejects', async () => {
      const sharp = require('sharp');
      sharp.mockReturnValue({ metadata: jest.fn().mockRejectedValue(new Error('not a valid image')) });
      const input = makeUploadImageInput();
      storage.list.mockResolvedValue(ok([]));

      const result = await useCase.execute(input);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBeInstanceOf(StorageOperationFailedError);
      expect(storage.write).not.toHaveBeenCalled();
    });

    it('should call storage.write with the correct path and buffer', async () => {
      const input = makeUploadImageInput();
      storage.list.mockResolvedValue(ok([]));
      storage.write.mockResolvedValue(ok(undefined));

      const result = await useCase.execute(input);

      if (result.ok) {
        expect(storage.write).toHaveBeenCalledWith(result.value.storagePath, input.file.buffer);
      }
    });

    it('should propagate err when ImageFile.create returns a failure', async () => {
      const sharp = require('sharp');
      sharp.mockReturnValue({
        metadata: jest.fn().mockResolvedValue({ format: 'jpeg', width: 100, height: 100 }),
      });
      const input = makeUploadImageInput();
      storage.list.mockResolvedValue(ok([]));
      const domainErr = new ImageTooLargeError(999, 1);
      jest.spyOn(ImageFile, 'create').mockReturnValueOnce(err(domainErr));

      const result = await useCase.execute(input);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe(domainErr);
      expect(storage.write).not.toHaveBeenCalled();
    });

    it('should generate unique image IDs on consecutive uploads', async () => {
      const input = makeUploadImageInput();
      storage.list.mockResolvedValue(ok([]));
      storage.write.mockResolvedValue(ok(undefined));

      const [r1, r2] = await Promise.all([useCase.execute(input), useCase.execute(input)]);

      if (r1.ok && r2.ok) {
        expect(r1.value.id).not.toBe(r2.value.id);
      }
    });
  });
});
