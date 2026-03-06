export class StorageOperationFailedError {
  readonly code = 'STORAGE_OPERATION_FAILED' as const;
  readonly message: string;

  constructor(
    readonly operation: string,
    readonly path: string,
  ) {
    this.message = `Storage ${operation} failed for path "${path}".`;
  }
}
