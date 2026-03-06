export { ImageNotFoundError } from './image-not-found.error';
export { ImageTooLargeError } from './image-too-large.error';
export { UnsupportedMimeTypeError } from './unsupported-mime-type.error';
export { ImagesLimitExceededError } from './images-limit-exceeded.error';
export { StorageOperationFailedError } from './storage-operation-failed.error';

import { ImageNotFoundError } from './image-not-found.error';
import { ImageTooLargeError } from './image-too-large.error';
import { UnsupportedMimeTypeError } from './unsupported-mime-type.error';
import { ImagesLimitExceededError } from './images-limit-exceeded.error';
import { StorageOperationFailedError } from './storage-operation-failed.error';

export type ImageError =
  | ImageNotFoundError
  | ImageTooLargeError
  | UnsupportedMimeTypeError
  | ImagesLimitExceededError
  | StorageOperationFailedError;
