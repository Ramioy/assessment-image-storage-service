// @ts-nocheck
/* eslint-disable */

import { envValidationSchema } from '@infrastructure/config/env-validation';

describe('envValidationSchema', () => {
  it('should validate successfully with all defaults when no env vars are provided', () => {
    const { error, value } = envValidationSchema.validate({});
    expect(error).toBeUndefined();
    expect(value.NODE_ENV).toBe('development');
    expect(value.PORT).toBe(3001);
    expect(value.HOST).toBe('0.0.0.0');
  });

  it('should accept valid NODE_ENV values', () => {
    for (const env of ['development', 'production', 'test']) {
      const { error } = envValidationSchema.validate({ NODE_ENV: env });
      expect(error).toBeUndefined();
    }
  });

  it('should reject an invalid NODE_ENV value', () => {
    const { error } = envValidationSchema.validate({ NODE_ENV: 'staging' });
    expect(error).toBeDefined();
  });

  it('should apply default values for optional fields', () => {
    const { value } = envValidationSchema.validate({});
    expect(value.API_KEY_ENABLED).toBe(false);
    expect(value.ENABLE_SWAGGER).toBe(true);
    expect(value.VOLUME_MOUNT_PATH).toBe('/data/images');
  });

  it('should accept extra keys without error due to unknown(true)', () => {
    const { error } = envValidationSchema.validate({ CUSTOM_VAR: 'anything' });
    expect(error).toBeUndefined();
  });
});
