import type { Result } from '@shared/result';
import type { StorageOperationFailedError } from '@domain/image/errors/storage-operation-failed.error';

export interface StoragePort {
  write(relativePath: string, buffer: Buffer): Promise<Result<void, StorageOperationFailedError>>;
  read(relativePath: string): Promise<Result<Buffer, StorageOperationFailedError>>;
  delete(relativePath: string): Promise<Result<void, StorageOperationFailedError>>;
  deleteDirectory(directoryPath: string): Promise<Result<void, StorageOperationFailedError>>;
  exists(relativePath: string): Promise<Result<boolean, StorageOperationFailedError>>;
  list(directoryPath: string): Promise<Result<string[], StorageOperationFailedError>>;
}
