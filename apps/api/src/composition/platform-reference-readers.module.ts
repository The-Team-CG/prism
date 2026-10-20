import { Global, Module } from '@nestjs/common';
import {
  PLATFORM_REFERENCE_READ_MODEL,
  PLATFORM_RETENTION_READ_MODEL,
  PlatformReferenceReadModelsService,
  PlatformRetentionReadModelsService,
} from '@prism/contexts/read-models';
import { ReadModelsModule } from '../modules/read-models/read-models.module';

/** Root composition bridge: Platform consumes read-only projections without importing ReadModels. */
@Global()
@Module({
  imports: [ReadModelsModule],
  providers: [
    { provide: PLATFORM_REFERENCE_READ_MODEL, useExisting: PlatformReferenceReadModelsService },
    { provide: PLATFORM_RETENTION_READ_MODEL, useExisting: PlatformRetentionReadModelsService },
  ],
  exports: [PLATFORM_REFERENCE_READ_MODEL, PLATFORM_RETENTION_READ_MODEL],
})
export class PlatformReferenceReadersModule {}
