import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { DI_TOKENS } from '@shared/di-tokens';
import { HEALTH_CHECK_FILE } from '@shared/constants/image.constants';
import { Public } from '@shared/guards/public.decorator';

import { type StoragePort } from '@application/image/ports/storage.port';

@ApiTags('Health')
@Controller('health')
@Public()
export class HealthController {
  constructor(
    @Inject(DI_TOKENS.STORAGE_PORT)
    private readonly storage: StoragePort,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Health check — verifies the volume is mounted and writable' })
  @ApiResponse({
    status: 200,
    description: 'Service health status',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['ok', 'degraded'] },
        storage: { type: 'string', enum: ['writable', 'unavailable'] },
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  })
  async check() {
    const writeResult = await this.storage.write(HEALTH_CHECK_FILE, Buffer.from('ok'));

    if (writeResult.ok) {
      await this.storage.delete(HEALTH_CHECK_FILE);
    }

    return {
      status: writeResult.ok ? 'ok' : 'degraded',
      storage: writeResult.ok ? 'writable' : 'unavailable',
      timestamp: new Date().toISOString(),
    };
  }
}
