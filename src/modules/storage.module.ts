import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { DI_TOKENS } from '@shared/di-tokens';

import { FilesystemAdapter } from '@infrastructure/storage/filesystem.adapter';

@Module({
  providers: [
    {
      provide: DI_TOKENS.STORAGE_PORT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const rootPath = config.get<string>('VOLUME_MOUNT_PATH', '/data/images');
        return new FilesystemAdapter(rootPath);
      },
    },
  ],
  exports: [DI_TOKENS.STORAGE_PORT],
})
export class StorageModule {}
