export class ImageNotFoundError {
  readonly code = 'IMAGE_NOT_FOUND' as const;
  readonly message: string;

  constructor(
    readonly productId: string,
    readonly imageId: string,
  ) {
    this.message = `Image "${imageId}" not found under product "${productId}".`;
  }
}
