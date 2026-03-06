// @ts-nocheck
/* eslint-disable */

import { ok, err } from '@shared/result';
import { HealthController } from '@presentation/health/health.controller';
import { StorageOperationFailedError } from '@domain/image/errors/storage-operation-failed.error';
import { makeStoragePortMock } from '../../../helpers/image.helper';

describe('HealthController', () => {
  let controller: HealthController;
  let storage: ReturnType<typeof makeStoragePortMock>;

  beforeEach(() => {
    storage = makeStoragePortMock();
    controller = new HealthController(storage);
  });

  describe('check()', () => {
    it('should return status ok and storage writable when write succeeds', async () => {
      storage.write.mockResolvedValue(ok(undefined));
      storage.delete.mockResolvedValue(ok(undefined));

      const result = await controller.check();

      expect(result.status).toBe('ok');
      expect(result.storage).toBe('writable');
      expect(result.timestamp).toBeDefined();
      expect(storage.delete).toHaveBeenCalled();
    });

    it('should return status degraded and storage unavailable when write fails', async () => {
      const storageErr = new StorageOperationFailedError('write', '.health');
      storage.write.mockResolvedValue(err(storageErr));

      const result = await controller.check();

      expect(result.status).toBe('degraded');
      expect(result.storage).toBe('unavailable');
      expect(storage.delete).not.toHaveBeenCalled();
    });
  });
});
