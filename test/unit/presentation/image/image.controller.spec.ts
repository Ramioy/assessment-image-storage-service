// @ts-nocheck
/* eslint-disable */

import { NotFoundException, ConflictException } from '@nestjs/common';
import { ok, err } from '@shared/result';
import { ImageNotFoundError } from '@domain/image/errors/image-not-found.error';
import { ImagesLimitExceededError } from '@domain/image/errors/images-limit-exceeded.error';
import {
  makeImageFileDto,
  makeBuffer,
  PRODUCT_UUID,
  IMAGE_UUID,
} from '../../../helpers/image.helper';

// Mock ImageValidationPipe before importing the controller
jest.mock('@presentation/image/pipes/image-validation.pipe');

import { ImageController } from '@presentation/image/image.controller';
import { ImageValidationPipe } from '@presentation/image/pipes/image-validation.pipe';

const makeMockFile = () => ({
  buffer: makeBuffer(),
  originalName: 'photo.jpg',
  mimeType: 'image/jpeg',
  sizeBytes: 19,
});

const makeMockReply = () => ({
  header: jest.fn().mockReturnThis(),
  send: jest.fn(),
});

describe('ImageController', () => {
  let controller: ImageController;
  let uploadUseCase: any;
  let serveUseCase: any;
  let listUseCase: any;
  let deleteUseCase: any;
  let deleteProductUseCase: any;
  let mockPipeInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockPipeInstance = { transform: jest.fn() };
    (ImageValidationPipe as jest.Mock).mockImplementation(() => mockPipeInstance);

    uploadUseCase = { execute: jest.fn() };
    serveUseCase = { execute: jest.fn() };
    listUseCase = { execute: jest.fn() };
    deleteUseCase = { execute: jest.fn() };
    deleteProductUseCase = { execute: jest.fn() };

    controller = new ImageController(
      uploadUseCase,
      serveUseCase,
      listUseCase,
      deleteUseCase,
      deleteProductUseCase,
    );
  });

  describe('upload()', () => {
    it('should return the image DTO on successful upload', async () => {
      const file = makeMockFile();
      const dto = makeImageFileDto();
      mockPipeInstance.transform.mockResolvedValue(file);
      uploadUseCase.execute.mockResolvedValue(ok(dto));
      const mockRequest: any = {};

      const result = await controller.upload(PRODUCT_UUID, mockRequest);

      expect(uploadUseCase.execute).toHaveBeenCalledWith({ productId: PRODUCT_UUID, file });
      expect(result).toBe(dto);
    });

    it('should throw when the pipe rejects the file', async () => {
      mockPipeInstance.transform.mockRejectedValue(new Error('bad file'));
      const mockRequest: any = {};

      await expect(controller.upload(PRODUCT_UUID, mockRequest)).rejects.toThrow('bad file');
    });

    it('should throw ConflictException when image limit is exceeded', async () => {
      const file = makeMockFile();
      mockPipeInstance.transform.mockResolvedValue(file);
      uploadUseCase.execute.mockResolvedValue(
        err(new ImagesLimitExceededError(PRODUCT_UUID, 20)),
      );
      const mockRequest: any = {};

      await expect(controller.upload(PRODUCT_UUID, mockRequest)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('list()', () => {
    it('should return an array of image IDs', async () => {
      const ids = [IMAGE_UUID, 'other-uuid'];
      listUseCase.execute.mockResolvedValue(ok(ids));

      const result = await controller.list(PRODUCT_UUID);

      expect(listUseCase.execute).toHaveBeenCalledWith({ productId: PRODUCT_UUID });
      expect(result).toBe(ids);
    });

    it('should return an empty array when product has no images', async () => {
      listUseCase.execute.mockResolvedValue(ok([]));

      const result = await controller.list(PRODUCT_UUID);

      expect(result).toEqual([]);
    });
  });

  describe('serve()', () => {
    it('should set Content-Type, Cache-Control, ETag, and Content-Disposition headers then send the buffer', async () => {
      const buf = makeBuffer();
      serveUseCase.execute.mockResolvedValue(ok({ buffer: buf, mimeType: 'image/png' }));
      const reply = makeMockReply();

      await controller.serve(PRODUCT_UUID, IMAGE_UUID, reply as any);

      expect(serveUseCase.execute).toHaveBeenCalledWith({ productId: PRODUCT_UUID, imageId: IMAGE_UUID });
      expect(reply.header).toHaveBeenCalledWith('Content-Type', 'image/png');
      expect(reply.header).toHaveBeenCalledWith('Cache-Control', 'public, max-age=31536000, immutable');
      expect(reply.header).toHaveBeenCalledWith('ETag', `"${IMAGE_UUID}"`);
      expect(reply.header).toHaveBeenCalledWith('Content-Disposition', 'inline');
      expect(reply.send).toHaveBeenCalledWith(buf);
    });

    it('should throw NotFoundException when image is not found', async () => {
      serveUseCase.execute.mockResolvedValue(
        err(new ImageNotFoundError(PRODUCT_UUID, IMAGE_UUID)),
      );
      const reply = makeMockReply();

      await expect(controller.serve(PRODUCT_UUID, IMAGE_UUID, reply as any)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('deleteOne()', () => {
    it('should call delete use case and return undefined', async () => {
      deleteUseCase.execute.mockResolvedValue(ok(undefined));

      const result = await controller.deleteOne(PRODUCT_UUID, IMAGE_UUID);

      expect(deleteUseCase.execute).toHaveBeenCalledWith({ productId: PRODUCT_UUID, imageId: IMAGE_UUID });
      expect(result).toBeUndefined();
    });

    it('should throw NotFoundException when image does not exist', async () => {
      deleteUseCase.execute.mockResolvedValue(
        err(new ImageNotFoundError(PRODUCT_UUID, IMAGE_UUID)),
      );

      await expect(controller.deleteOne(PRODUCT_UUID, IMAGE_UUID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('deleteAll()', () => {
    it('should call deleteProduct use case and return undefined', async () => {
      deleteProductUseCase.execute.mockResolvedValue(ok(undefined));

      const result = await controller.deleteAll(PRODUCT_UUID);

      expect(deleteProductUseCase.execute).toHaveBeenCalledWith({ productId: PRODUCT_UUID });
      expect(result).toBeUndefined();
    });
  });
});
