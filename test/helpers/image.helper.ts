/**
 * Image test helpers
 * ─────────────────────────────────────────────────────────────
 * Factories for domain objects, DTOs, and port mocks. Use these
 * in unit and integration tests to avoid repeating fixture code.
 */

import { ImageFile, type ImageFileDto, type CreateImageFileDto } from '@domain/image/image-file.value-object';
import type { StoragePort } from '@application/image/ports/storage.port';
import type { UploadImageInput } from '@application/image/use-cases/upload-image.use-case';

// Valid RFC-4122 v4 UUIDs (version nibble = 4, variant nibble = 8-b)
export const PRODUCT_UUID = 'a1b2c3d4-1234-4567-89ab-ef1234567890';
export const IMAGE_UUID = 'b2c3d4e5-2345-4678-9abc-f12345678901';

// ── DTOs ──────────────────────────────────────────────────────

export function makeImageFileDto(overrides: Partial<ImageFileDto> = {}): ImageFileDto {
  return {
    id: IMAGE_UUID,
    productId: PRODUCT_UUID,
    originalName: 'test-image.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 1024,
    storagePath: `${PRODUCT_UUID}/${IMAGE_UUID}.jpg`,
    ...overrides,
  };
}

export function makeCreateImageFileDto(overrides: Partial<CreateImageFileDto> = {}): CreateImageFileDto {
  return makeImageFileDto(overrides);
}

// ── Value object ──────────────────────────────────────────────

export function makeImageFile(overrides: Partial<CreateImageFileDto> = {}): ImageFile {
  const dto = makeCreateImageFileDto(overrides);
  const result = ImageFile.create(dto, 10 * 1024 * 1024);
  if (!result.ok) throw new Error(`makeImageFile failed: ${result.error.message}`);
  return result.value;
}

// ── Use-case input ────────────────────────────────────────────

export function makeUploadImageInput(overrides: Partial<UploadImageInput> = {}): UploadImageInput {
  return {
    productId: PRODUCT_UUID,
    file: {
      buffer: Buffer.from('fake-image-data'),
      originalName: 'test-image.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 15,
    },
    ...overrides,
  };
}

// ── Buffer ────────────────────────────────────────────────────

export function makeBuffer(): Buffer {
  return Buffer.from('fake-binary-content');
}

// ── Storage port mock ─────────────────────────────────────────

type MockedStoragePort = { [K in keyof StoragePort]: jest.Mock };

export function makeStoragePortMock(): MockedStoragePort {
  return {
    write: jest.fn(),
    read: jest.fn(),
    delete: jest.fn(),
    deleteDirectory: jest.fn(),
    exists: jest.fn(),
    list: jest.fn(),
  };
}

// ── Config service mock ───────────────────────────────────────

export function makeConfigServiceMock(
  overrides: Record<string, unknown> = {},
): { get: jest.Mock } {
  const defaults: Record<string, unknown> = {
    MAX_FILE_SIZE_MB: 10,
    MAX_IMAGES_PER_PRODUCT: 20,
    ...overrides,
  };

  return {
    get: jest.fn().mockImplementation((key: string, defaultVal: unknown) => {
      return key in defaults ? defaults[key] : defaultVal;
    }),
  };
}
