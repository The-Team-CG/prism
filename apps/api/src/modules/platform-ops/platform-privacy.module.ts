import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/kernel/database';
import { EventSessionModule } from '@prism/kernel/event-session';
import { CommercialModule } from '../commercial/commercial.module';
import { EventLifecycleModule } from '../event-lifecycle/event-lifecycle.module';
import { IdentityAccessModule } from '../identity-access/identity-access.module';
import { OperationsModule } from '../operations/operations.module';
import { PlatformReferenceReadersModule } from '../../composition/platform-reference-readers.module';
import { OpsPrivacyController } from './api/trust/audit-privacy.controller';
import { OpsPrivacyRetentionController } from './api/trust/privacy-retention.controller';
import { PrivacyOperationsService } from './application/trust/privacy-operations.service';
import { PrivacyRetentionExecutorService } from './application/retention/privacy-retention-executor.service';
import { PrivacyRetentionSweepScheduler } from './application/retention/privacy-retention-sweep.scheduler';
import { PrivacyRetentionSweepService } from './application/retention/privacy-retention-sweep.service';
import { PrivacyRetentionService } from './application/retention/privacy-retention.service';
import { PrivacyRequestQueueService } from './application/trust/privacy-request-queue.service';
import { PlatformOpsModule } from './platform-ops.module';

/**
 * Platform privacy composition sits at the application edge so the owner
 * contexts can continue importing PlatformOps without a module cycle.
 */
@Module({
  imports: [
    DatabaseModule,
    EventSessionModule,
    PlatformOpsModule,
    EventLifecycleModule,
    CommercialModule,
    OperationsModule,
    IdentityAccessModule,
    PlatformReferenceReadersModule,
  ],
  controllers: [OpsPrivacyController, OpsPrivacyRetentionController],
  providers: [
    PrivacyOperationsService,
    PrivacyRequestQueueService,
    PrivacyRetentionService,
    PrivacyRetentionExecutorService,
    PrivacyRetentionSweepService,
    PrivacyRetentionSweepScheduler,
  ],
  exports: [PrivacyOperationsService],
})
export class PlatformPrivacyModule {}
