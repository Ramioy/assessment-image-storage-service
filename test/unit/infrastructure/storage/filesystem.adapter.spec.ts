// @ts-nocheck
/* eslint-disable */

import { StorageOperationFailedError } from '@domain/image/errors/storage-operation-failed.error';
import { FilesystemAdapter } from '@infrastructure/storage/filesystem.adapter';

jest.mock('node:fs/promises', () => ({
  mkdir: jest.fn(),
  writeFile: jest.fn(),
  readFile: jest.fn(),
  rm: jest.fn(),
  access: jest.fn(),
  readdir: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const fsMock = require('node:fs/promises');

describe('FilesystemAdapter', () => {
  let adapter: FilesystemAdapter;
  const root = '/tmp/test-root';

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new FilesystemAdapter(root);
    // Silence logger output during tests
    jest.spyOn(adapter['logger'], 'error').mockImplementation(() => {});
  });

  describe('write()', () => {
    it('should return ok(undefined) when mkdir and writeFile succeed', async () => {
      fsMock.mkdir.mockResolvedValue(undefined);
      fsMock.writeFile.mockResolvedValue(undefined);

      const result = await adapter.write('product/img.jpg', Buffer.from('data'));

      expect(result.ok).toBe(true);
      expect(fsMock.mkdir).toHaveBeenCalledWith(`${root}/product`, { recursive: true });
      expect(fsMock.writeFile).toHaveBeenCalledWith(`${root}/product/img.jpg`, Buffer.from('data'));
    });

    it('should return err(StorageOperationFailedError) when writeFile throws', async () => {
      fsMock.mkdir.mockResolvedValue(undefined);
      fsMock.writeFile.mockRejectedValue(new Error('disk full'));

      const result = await adapter.write('product/img.jpg', Buffer.from('data'));

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBeInstanceOf(StorageOperationFailedError);
    });
  });

  describe('read()', () => {
    it('should return ok(Buffer) when readFile succeeds', async () => {
      const buf = Buffer.from('image-bytes');
      fsMock.readFile.mockResolvedValue(buf);

      const result = await adapter.read('product/img.jpg');

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe(buf);
    });

    it('should return err(StorageOperationFailedError) when readFile throws', async () => {
      fsMock.readFile.mockRejectedValue(new Error('ENOENT'));

      const result = await adapter.read('product/img.jpg');

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBeInstanceOf(StorageOperationFailedError);
    });
  });

  describe('delete()', () => {
    it('should return ok(undefined) when rm succeeds', async () => {
      fsMock.rm.mockResolvedValue(undefined);

      const result = await adapter.delete('product/img.jpg');

      expect(result.ok).toBe(true);
      expect(fsMock.rm).toHaveBeenCalledWith(`${root}/product/img.jpg`, { force: true });
    });

    it('should return err(StorageOperationFailedError) when rm throws', async () => {
      fsMock.rm.mockRejectedValue(new Error('permission denied'));

      const result = await adapter.delete('product/img.jpg');

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBeInstanceOf(StorageOperationFailedError);
    });
  });

  describe('deleteDirectory()', () => {
    it('should return ok(undefined) when rm with recursive succeeds', async () => {
      fsMock.rm.mockResolvedValue(undefined);

      const result = await adapter.deleteDirectory('product-uuid');

      expect(result.ok).toBe(true);
      expect(fsMock.rm).toHaveBeenCalledWith(`${root}/product-uuid`, {
        recursive: true,
        force: true,
      });
    });

    it('should return err(StorageOperationFailedError) when rm throws', async () => {
      fsMock.rm.mockRejectedValue(new Error('io error'));

      const result = await adapter.deleteDirectory('product-uuid');

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBeInstanceOf(StorageOperationFailedError);
    });
  });

  describe('exists()', () => {
    it('should return ok(true) when access succeeds (file exists)', async () => {
      fsMock.access.mockResolvedValue(undefined);

      const result = await adapter.exists('product/img.jpg');

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe(true);
    });

    it('should return ok(false) when access throws (file does not exist)', async () => {
      fsMock.access.mockRejectedValue(new Error('ENOENT'));

      const result = await adapter.exists('product/img.jpg');

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe(false);
    });
  });

  describe('list()', () => {
    it('should return ok(string[]) with directory entries when readdir succeeds', async () => {
      fsMock.readdir.mockResolvedValue(['img1.jpg', 'img2.png']);

      const result = await adapter.list('product-uuid');

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toEqual(['img1.jpg', 'img2.png']);
    });

    it('should return ok([]) when readdir throws (directory does not exist)', async () => {
      fsMock.readdir.mockRejectedValue(new Error('ENOENT'));

      const result = await adapter.list('product-uuid');

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toEqual([]);
    });
  });
});
