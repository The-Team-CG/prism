import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/kernel/database';
import { OPERATIONS_LIVE_OPS_REFERENCE_READER } from './contracts/live-ops-reference.port';
import { LiveOpsReferenceService } from './application/staffing/live-ops-reference.service';

/** Operations-owned, transaction-aware references used by LiveOps. */
@Module({
  imports: [DatabaseModule],
  providers: [
    LiveOpsReferenceService,
    { provide: OPERATIONS_LIVE_OPS_REFERENCE_READER, useExisting: LiveOpsReferenceService },
  ],
  exports: [OPERATIONS_LIVE_OPS_REFERENCE_READER],
})
export class LiveOpsReferenceModule {}
