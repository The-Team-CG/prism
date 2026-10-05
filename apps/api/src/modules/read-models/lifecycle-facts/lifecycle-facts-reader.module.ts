import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/kernel/database';
import { LIFECYCLE_FACTS_READER } from './lifecycle-facts-reader.port';
import { LifecycleFactsReaderService } from './lifecycle-facts-reader.service';

/** Narrow read-only composition for Lifecycle; avoids importing the full ReadModelsModule. */
@Module({
  imports: [DatabaseModule],
  providers: [LifecycleFactsReaderService, { provide: LIFECYCLE_FACTS_READER, useExisting: LifecycleFactsReaderService }],
  exports: [LIFECYCLE_FACTS_READER],
})
export class LifecycleFactsReaderModule {}
