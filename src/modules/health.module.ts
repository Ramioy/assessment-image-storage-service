import { Module } from '@nestjs/common';

import { HealthController } from '@presentation/health/health.controller';

import { StorageModule } from './storage.module';

@Module({
  imports: [StorageModule],
  controllers: [HealthController],
})
export class HealthModule {}
