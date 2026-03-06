// @ts-nocheck
/* eslint-disable */

import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { FilesystemAdapter } from '@infrastructure/storage/filesystem.adapter';
import { StorageOperationFailedError } from '@domain/image/errors/storage-operation-failed.error';

describe('FilesystemAdapter (integration)', () => {
  let adapter: FilesystemAdapter;
  let rootPath: string;

  beforeEach(async () => {
    rootPath = await mkdtemp(join(tmpdir(), 'fs-adapter-test-'));
    adapter = new FilesystemAdapter(rootPath);
  });

  afterEach(async () => {
    await rm(rootPath, { recursive: true, force: true });
  });

  describe('write()', () => {
    it('should write a file and return ok', async () => {
      const result = await adapter.write('product-1/image.jpg', Buffer.from('binary-data'));

      expect(result.ok).toBe(true);
    });

    it('should create parent directories automatically', async () => {
      await adapter.write('deep/nested/path/image.png', Buffer.from('data'));

      const content = await readFile(join(rootPath, 'deep/nested/path/image.png'));
      expect(content.toString()).toBe('data');
    });

    it('should persist the exact buffer contents', async () => {
      const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
      await adapter.write('product/img.png', buf);

      const read = await readFile(join(rootPath, 'product/img.png'));
      expect(read).toEqual(buf);
    });
  });

  describe('read()', () => {
    it('should read back a previously written file', async () => {
      const buf = Buffer.from('hello-world');
      await adapter.write('product/hello.txt', buf);

      const result = await adapter.read('product/hello.txt');

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.toString()).toBe('hello-world');
    });

    it('should return err(StorageOperationFailedError) for a non-existent file', async () => {
      const result = await adapter.read('does/not/exist.jpg');

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBeInstanceOf(StorageOperationFailedError);
    });
  });

  describe('delete()', () => {
    it('should delete an existing file and return ok', async () => {
      await adapter.write('product/del.jpg', Buffer.from('x'));
      const existsBefore = await adapter.exists('product/del.jpg');
      expect(existsBefore.ok && existsBefore.value).toBe(true);

      const result = await adapter.delete('product/del.jpg');

      expect(result.ok).toBe(true);
      const existsAfter = await adapter.exists('product/del.jpg');
      expect(existsAfter.ok && existsAfter.value).toBe(false);
    });

    it('should return ok even when the file does not exist (force delete)', async () => {
      const result = await adapter.delete('product/ghost.jpg');

      expect(result.ok).toBe(true);
    });
  });

  describe('deleteDirectory()', () => {
    it('should delete a directory and all its contents', async () => {
      await adapter.write('product-x/a.jpg', Buffer.from('a'));
      await adapter.write('product-x/b.png', Buffer.from('b'));

      const result = await adapter.deleteDirectory('product-x');

      expect(result.ok).toBe(true);
      const listResult = await adapter.list('product-x');
      expect(listResult.ok && listResult.value).toEqual([]);
    });

    it('should return ok when the directory does not exist', async () => {
      const result = await adapter.deleteDirectory('non-existent-product');

      expect(result.ok).toBe(true);
    });
  });

  describe('exists()', () => {
    it('should return ok(true) for an existing file', async () => {
      await adapter.write('product/exists.jpg', Buffer.from('data'));

      const result = await adapter.exists('product/exists.jpg');

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe(true);
    });

    it('should return ok(false) for a non-existent path', async () => {
      const result = await adapter.exists('product/missing.jpg');

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe(false);
    });
  });

  describe('list()', () => {
    it('should return ok([]) for a non-existent directory', async () => {
      const result = await adapter.list('product-no-images');

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toEqual([]);
    });

    it('should return the file names for an existing directory', async () => {
      await adapter.write('product-y/a.jpg', Buffer.from('a'));
      await adapter.write('product-y/b.png', Buffer.from('b'));

      const result = await adapter.list('product-y');

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.sort()).toEqual(['a.jpg', 'b.png']);
    });

    it('should return only direct children, not nested paths', async () => {
      await adapter.write('product-z/img1.jpg', Buffer.from('1'));
      await adapter.write('product-z/img2.webp', Buffer.from('2'));

      const result = await adapter.list('product-z');

      if (result.ok) {
        for (const entry of result.value) {
          expect(entry).not.toContain('/');
        }
      }
    });
  });
});
