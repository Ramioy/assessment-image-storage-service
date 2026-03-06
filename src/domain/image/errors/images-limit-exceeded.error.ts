export class ImagesLimitExceededError {
  readonly code = 'IMAGES_LIMIT_EXCEEDED' as const;
  readonly message: string;

  constructor(
    readonly productId: string,
    readonly maxImages: number,
  ) {
    this.message = `Product "${productId}" has reached the maximum of ${maxImages} images.`;
  }
}
