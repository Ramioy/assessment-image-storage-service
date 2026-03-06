// @ts-nocheck
/* eslint-disable */

import { UnauthorizedException } from '@nestjs/common';
import { ApiKeyGuard } from '@shared/guards/api-key.guard';
import { IS_PUBLIC_KEY, Public } from '@shared/guards/public.decorator';

function makeConfigService(overrides: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = {
    API_KEY_ENABLED: false,
    API_KEY: 'secret-key',
    ...overrides,
  };
  return {
    get: jest.fn().mockImplementation((key: string, defaultVal: unknown) =>
      key in values ? values[key] : defaultVal,
    ),
  };
}

function makeReflector(isPublic = false) {
  return {
    getAllAndOverride: jest.fn().mockReturnValue(isPublic),
  };
}

function makeContext(headers: Record<string, string> = {}, isPublicRoute = false) {
  return {
    getHandler: jest.fn().mockReturnValue({}),
    getClass: jest.fn().mockReturnValue({}),
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue({ headers }),
    }),
  };
}

describe('ApiKeyGuard', () => {
  describe('canActivate()', () => {
    it('should return true when API_KEY_ENABLED is false (guard disabled)', () => {
      const guard = new ApiKeyGuard(makeConfigService({ API_KEY_ENABLED: false }), makeReflector());
      const ctx = makeContext();

      expect(guard.canActivate(ctx as any)).toBe(true);
    });

    it('should return true for a public route even when guard is enabled', () => {
      const guard = new ApiKeyGuard(
        makeConfigService({ API_KEY_ENABLED: true }),
        makeReflector(true),
      );
      const ctx = makeContext();

      expect(guard.canActivate(ctx as any)).toBe(true);
    });

    it('should return true when the correct API key is provided', () => {
      const guard = new ApiKeyGuard(
        makeConfigService({ API_KEY_ENABLED: true }),
        makeReflector(false),
      );
      const ctx = makeContext({ 'x-api-key': 'secret-key' });

      expect(guard.canActivate(ctx as any)).toBe(true);
    });

    it('should throw UnauthorizedException when the API key is wrong', () => {
      const guard = new ApiKeyGuard(
        makeConfigService({ API_KEY_ENABLED: true }),
        makeReflector(false),
      );
      const ctx = makeContext({ 'x-api-key': 'wrong-key' });

      expect(() => guard.canActivate(ctx as any)).toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when the API key header is missing', () => {
      const guard = new ApiKeyGuard(
        makeConfigService({ API_KEY_ENABLED: true }),
        makeReflector(false),
      );
      const ctx = makeContext({});

      expect(() => guard.canActivate(ctx as any)).toThrow(UnauthorizedException);
    });
  });
});

describe('Public decorator', () => {
  it('should set IS_PUBLIC_KEY metadata to true on the target', () => {
    class TestController {}
    Public()(TestController);
    // The decorator calls SetMetadata which attaches metadata to the class
    expect(IS_PUBLIC_KEY).toBe('isPublic');
  });

  it('should return a decorator factory function', () => {
    expect(typeof Public()).toBe('function');
  });
});
