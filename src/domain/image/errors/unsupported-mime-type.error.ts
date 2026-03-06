import { ALLOWED_MIME_TYPES } from '@shared/constants/image.constants';

export class UnsupportedMimeTypeError {
  readonly code = 'UNSUPPORTED_MIME_TYPE' as const;
  readonly message: string;

  constructor(readonly mimeType: string) {
    this.message = `MIME type "${mimeType}" is not supported. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}.`;
  }
}
