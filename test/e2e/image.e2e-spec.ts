// @ts-nocheck
/* eslint-disable */

import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import sharp from 'sharp';
import { AppModule } from '../../src/app.module';
import { FilesystemAdapter } from '../../src/infrastructure/storage/filesystem.adapter';
import { DI_TOKENS } from '../../src/shared/di-tokens';
import { BYTES_PER_MB } from '../../src/shared/constants/image.constants';

// Valid RFC-4122 v4 UUIDs used as URL path params (must pass ParseUUIDPipe)
const PRODUCT_UUID = 'a1b2c3d4-1234-4567-89ab-ef1234567890';
const BOUNDARY = 'e2e-test-boundary';

async function makeTinyPngBuffer(): Promise<Buffer> {
  return sharp({
    create: { width: 1, height: 1, channels: 3, background: { r: 100, g: 150, b: 200 } },
  })
    .png()
    .toBuffer();
}

function buildMultipartBody(fileBuffer: Buffer, filename: string, mimeType: string): Buffer {
  const header = Buffer.from(
    `--${BOUNDARY}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`,
  );
  const footer = Buffer.from(`\r\n--${BOUNDARY}--\r\n`);
  return Buffer.concat([header, fileBuffer, footer]);
}

describe('Image E2E (full flow)', () => {
  let app: NestFastifyApplication;
  let tmpRoot: string;
  const baseUrl = '/api/test/v1';

  beforeAll(async () => {
    tmpRoot = await mkdtemp(join(tmpdir(), 'e2e-images-'));

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      // Override the storage port to use the tmp directory instead of /data/images
      .overrideProvider(DI_TOKENS.STORAGE_PORT)
      .useFactory({ factory: () => new FilesystemAdapter(tmpRoot) })
      .compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());

    await app.register(import('@fastify/multipart'), {
      limits: { fileSize: 10 * BYTES_PER_MB },
    });

    app.setGlobalPrefix(baseUrl);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
    await rm(tmpRoot, { recursive: true, force: true });
  });

  describe('POST /products/:productId/images', () => {
    it('should upload an image and return 201 with image metadata', async () => {
      const pngBuffer = await makeTinyPngBuffer();
      const payload = buildMultipartBody(pngBuffer, 'test.png', 'image/png');

      const response = await app.inject({
        method: 'POST',
        url: `${baseUrl}/products/${PRODUCT_UUID}/images`,
        headers: { 'content-type': `multipart/form-data; boundary=${BOUNDARY}` },
        payload,
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.productId).toBe(PRODUCT_UUID);
      expect(body.mimeType).toBe('image/png');
      expect(body.storagePath).toMatch(new RegExp(`^${PRODUCT_UUID}/`));
      expect(body.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it('should return 415 for an unsupported MIME type', async () => {
      const payload = buildMultipartBody(Buffer.from('%PDF'), 'file.pdf', 'application/pdf');

      const response = await app.inject({
        method: 'POST',
        url: `${baseUrl}/products/${PRODUCT_UUID}/images`,
        headers: { 'content-type': `multipart/form-data; boundary=${BOUNDARY}` },
        payload,
      });

      expect(response.statusCode).toBe(415);
    });
  });

  describe('GET /products/:productId/images', () => {
    it('should list uploaded image IDs', async () => {
      // Use a distinct product so this test is isolated
      const productId = 'b2c3d4e5-2345-4678-9abc-f12345678901';
      const pngBuffer = await makeTinyPngBuffer();
      const uploadPayload = buildMultipartBody(pngBuffer, 'img.png', 'image/png');

      const uploadResp = await app.inject({
        method: 'POST',
        url: `${baseUrl}/products/${productId}/images`,
        headers: { 'content-type': `multipart/form-data; boundary=${BOUNDARY}` },
        payload: uploadPayload,
      });
      expect(uploadResp.statusCode).toBe(201);
      const uploadedId = uploadResp.json().id;

      const listResp = await app.inject({
        method: 'GET',
        url: `${baseUrl}/products/${productId}/images`,
      });

      expect(listResp.statusCode).toBe(200);
      expect(listResp.json()).toContain(uploadedId);
    });

    it('should return an empty array for a product with no images', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `${baseUrl}/products/c3d4e5f6-3456-4789-abcd-123456789012/images`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual([]);
    });
  });

  describe('GET /products/:productId/images/:imageId', () => {
    it('should serve the image binary with correct Content-Type header', async () => {
      const productId = 'd4e5f601-4567-489a-bcde-234567890123';
      const pngBuffer = await makeTinyPngBuffer();
      const uploadPayload = buildMultipartBody(pngBuffer, 'serve.png', 'image/png');

      const uploadResp = await app.inject({
        method: 'POST',
        url: `${baseUrl}/products/${productId}/images`,
        headers: { 'content-type': `multipart/form-data; boundary=${BOUNDARY}` },
        payload: uploadPayload,
      });
      expect(uploadResp.statusCode).toBe(201);
      const imageId = uploadResp.json().id;

      const serveResp = await app.inject({
        method: 'GET',
        url: `${baseUrl}/products/${productId}/images/${imageId}`,
      });

      expect(serveResp.statusCode).toBe(200);
      expect(serveResp.headers['content-type']).toContain('image/png');
      expect(serveResp.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    });

    it('should return 404 for a non-existent image', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `${baseUrl}/products/${PRODUCT_UUID}/images/e5f60112-5678-49ab-8def-345678901234`,
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('DELETE /products/:productId/images/:imageId', () => {
    it('should delete a single image and return 204', async () => {
      const productId = 'f6071223-6789-4bcd-9ef0-456789012345';
      const pngBuffer = await makeTinyPngBuffer();
      const uploadPayload = buildMultipartBody(pngBuffer, 'del.png', 'image/png');

      const uploadResp = await app.inject({
        method: 'POST',
        url: `${baseUrl}/products/${productId}/images`,
        headers: { 'content-type': `multipart/form-data; boundary=${BOUNDARY}` },
        payload: uploadPayload,
      });
      expect(uploadResp.statusCode).toBe(201);
      const imageId = uploadResp.json().id;

      const deleteResp = await app.inject({
        method: 'DELETE',
        url: `${baseUrl}/products/${productId}/images/${imageId}`,
      });
      expect(deleteResp.statusCode).toBe(204);

      const listResp = await app.inject({
        method: 'GET',
        url: `${baseUrl}/products/${productId}/images`,
      });
      expect(listResp.json()).not.toContain(imageId);
    });

    it('should return 404 when deleting a non-existent image', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `${baseUrl}/products/${PRODUCT_UUID}/images/17283849-1728-4384-9950-617283849506`,
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('DELETE /products/:productId/images', () => {
    it('should delete all images for a product and return 204', async () => {
      const productId = '28394a5b-2839-4a5b-8c6d-7e8f9a0b1c2d';
      const pngBuffer = await makeTinyPngBuffer();

      for (let i = 0; i < 3; i++) {
        const payload = buildMultipartBody(pngBuffer, `img${i}.png`, 'image/png');
        const resp = await app.inject({
          method: 'POST',
          url: `${baseUrl}/products/${productId}/images`,
          headers: { 'content-type': `multipart/form-data; boundary=${BOUNDARY}` },
          payload,
        });
        expect(resp.statusCode).toBe(201);
      }

      const deleteResp = await app.inject({
        method: 'DELETE',
        url: `${baseUrl}/products/${productId}/images`,
      });
      expect(deleteResp.statusCode).toBe(204);

      const listResp = await app.inject({
        method: 'GET',
        url: `${baseUrl}/products/${productId}/images`,
      });
      expect(listResp.json()).toEqual([]);
    });
  });

  describe('GET /health', () => {
    it('should return 200 with status ok when the volume is writable', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `${baseUrl}/health`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.status).toBe('ok');
      expect(body.storage).toBe('writable');
      expect(body.timestamp).toBeDefined();
    });
  });
});
