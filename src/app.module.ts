import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { envValidationSchema } from '@infrastructure/config/env-validation';

import { ImageModule } from './modules/image.module';
import { HealthModule } from './modules/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath:
        process.env.NODE_ENV === 'production'
          ? 'environment/production/.env'
          : 'environment/development/.env',
      validationSchema: envValidationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: true,
      },
    }),
    ImageModule,
    HealthModule,
  ],
})
export class AppModule {}
