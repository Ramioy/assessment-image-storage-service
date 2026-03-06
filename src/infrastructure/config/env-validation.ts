import Joi from 'joi';

import {
  DEFAULT_MAX_FILE_SIZE_MB,
  DEFAULT_MAX_IMAGES_PER_PRODUCT,
} from '@shared/constants/image.constants';

export const envValidationSchema = Joi.object({
  // Application environment
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),

  // Server configuration
  PORT: Joi.number().integer().default(3001),
  HOST: Joi.string().default('0.0.0.0'),

  // Logging
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'debug', 'verbose', 'silly')
    .default('debug'),

  // CORS
  CORS_ENABLED: Joi.boolean().default(true),
  CORS_ORIGIN: Joi.string().default('*'),

  // API
  API_PREFIX: Joi.string().default('/api'),
  API_VERSION: Joi.string().default('v1'),

  // API key guard
  API_KEY_ENABLED: Joi.boolean().default(false),
  API_KEY: Joi.string().optional(),

  // Feature flags
  ENABLE_SWAGGER: Joi.boolean().default(true),
  ENABLE_HEALTH_CHECK: Joi.boolean().default(true),

  // Application information
  APP_NAME: Joi.string().default('assessment-image-storage-service'),
  APP_DESCRIPTION: Joi.string().default(
    'Microservice for uploading, serving, and deleting product image files',
  ),

  // Volume storage
  VOLUME_MOUNT_PATH: Joi.string().default('/data/images'),
  MAX_FILE_SIZE_MB: Joi.number().integer().positive().default(DEFAULT_MAX_FILE_SIZE_MB),
  MAX_IMAGES_PER_PRODUCT: Joi.number().integer().positive().default(DEFAULT_MAX_IMAGES_PER_PRODUCT),
}).unknown(true);
