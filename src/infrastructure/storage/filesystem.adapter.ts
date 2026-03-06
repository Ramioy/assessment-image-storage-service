import { access, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { Injectable, Logger } from '@nestjs/common';

import { err, ok, type Result } from '@shared/result';

import { StorageOperationFailedError } from '@domain/image/errors/storage-operation-failed.error';

import { type StoragePort } from '@application/image/ports/storage.port';

@Injectable()
export class FilesystemAdapter implements StoragePort {
  private readonly logger = new Logger(FilesystemAdapter.name);

  constructor(private readonly rootPath: string) {}

  async write(
    relativePath: string,
    buffer: Buffer,
  ): Promise<Result<void, StorageOperationFailedError>> {
    const absolute = join(this.rootPath, relativePath);
    try {
      await mkdir(dirname(absolute), { recursive: true });
      await writeFile(absolute, buffer);
      return ok(undefined);
    } catch (e) {
      this.logger.error(`FS write failed: ${absolute}`, e);
      return err(new StorageOperationFailedError('write', relativePath));
    }
  }

  async read(relativePath: string): Promise<Result<Buffer, StorageOperationFailedError>> {
    const absolute = join(this.rootPath, relativePath);
    try {
      const buffer = await readFile(absolute);
      return ok(buffer);
    } catch (e) {
      this.logger.error(`FS read failed: ${absolute}`, e);
      return err(new StorageOperationFailedError('read', relativePath));
    }
  }

  async delete(relativePath: string): Promise<Result<void, StorageOperationFailedError>> {
    const absolute = join(this.rootPath, relativePath);
    try {
      await rm(absolute, { force: true });
      return ok(undefined);
    } catch (e) {
      this.logger.error(`FS delete failed: ${absolute}`, e);
      return err(new StorageOperationFailedError('delete', relativePath));
    }
  }

  async deleteDirectory(directoryPath: string): Promise<Result<void, StorageOperationFailedError>> {
    const absolute = join(this.rootPath, directoryPath);
    try {
      await rm(absolute, { recursive: true, force: true });
      return ok(undefined);
    } catch (e) {
      this.logger.error(`FS deleteDirectory failed: ${absolute}`, e);
      return err(new StorageOperationFailedError('deleteDirectory', directoryPath));
    }
  }

  async exists(relativePath: string): Promise<Result<boolean, StorageOperationFailedError>> {
    const absolute = join(this.rootPath, relativePath);
    try {
      await access(absolute);
      return ok(true);
    } catch {
      // access throws when the path does not exist — this is not an error, just absence
      return ok(false);
    }
  }

  async list(directoryPath: string): Promise<Result<string[], StorageOperationFailedError>> {
    const absolute = join(this.rootPath, directoryPath);
    try {
      const entries = await readdir(absolute);
      return ok(entries);
    } catch {
      // directory may not exist yet (no images uploaded for this product) — return empty list
      return ok([]);
    }
  }
}
