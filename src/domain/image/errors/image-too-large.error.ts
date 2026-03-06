export class ImageTooLargeError {
  readonly code = 'IMAGE_TOO_LARGE' as const;
  readonly message: string;

  constructor(
    readonly sizeBytes: number,
    readonly maxBytes: number,
  ) {
    this.message = `Image size ${sizeBytes} bytes exceeds the maximum of ${maxBytes} bytes.`;
  }
}
