import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { BYTES_PER_MB, DEFAULT_MAX_FILE_SIZE_MB } from '@shared/constants/image.constants';
import { HttpErrorFilter } from '@shared/filters/http-exception.filter';
import { LoggingInterceptor } from '@shared/interceptors/logging.interceptor';

import { AppModule } from './app.module';

const logger = new Logger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 3001);
  const host = config.get<string>('HOST', '0.0.0.0');
  const nodeEnv = config.get<string>('NODE_ENV', 'development');
  const apiPrefix = config.get<string>('API_PREFIX', '/api');
  const apiVersion = config.get<string>('API_VERSION', 'v1');
  const corsEnabled = config.get<boolean>('CORS_ENABLED', true);
  const corsOrigin = config.get<string>('CORS_ORIGIN', '*');
  const enableSwagger = config.get<boolean>('ENABLE_SWAGGER', true);
  const appName = config.get<string>('APP_NAME', 'assessment-image-storage-service');
  const appDescription = config.get<string>('APP_DESCRIPTION', '');
  const maxFileSizeMb = config.get<number>('MAX_FILE_SIZE_MB', DEFAULT_MAX_FILE_SIZE_MB);

  // Global API prefix: e.g. /api/development/v1
  app.setGlobalPrefix(`${apiPrefix}/${nodeEnv}/${apiVersion}`);

  // Multipart support (must be registered before routes are resolved)
  await app.register(import('@fastify/multipart'), {
    limits: {
      fileSize: maxFileSizeMb * BYTES_PER_MB,
    },
  });

  // Helmet security headers
  await app.register(import('@fastify/helmet'), {
    contentSecurityPolicy: false,
  });

  // CORS via Fastify plugin
  if (corsEnabled) {
    const origins = corsOrigin
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
    await app.register(import('@fastify/cors'), {
      origin: origins.length === 1 && origins[0] === '*' ? true : origins,
      methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    });
  }

  // Swagger / OpenAPI
  if (enableSwagger) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle(appName)
      .setDescription(appDescription)
      .setVersion(apiVersion)
      .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'x-api-key')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  // Global interceptors and filters
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.useGlobalFilters(new HttpErrorFilter());

  // Graceful shutdown
  app.enableShutdownHooks();

  await app.listen(port, host);
  logger.log(`Application is running on: ${await app.getUrl()}`);
  logger.log(`Environment: ${nodeEnv}`);
  logger.log(`Global prefix: ${apiPrefix}/${nodeEnv}/${apiVersion}`);
}

bootstrap().catch((error) => {
  logger.error('Failed to start application:', error);
  process.exit(1);
});
