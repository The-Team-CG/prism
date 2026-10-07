import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/kernel/database';
import { EventSessionModule } from '@prism/kernel/event-session';
import { CommercialModule } from '../commercial/commercial.module';
import { EventLifecycleModule } from '../event-lifecycle/event-lifecycle.module';
import { IdentityAccessModule } from '../identity-access/identity-access.module';
import { OperationsModule } from '../operations/operations.module';
import { PlatformReferenceReadersModule } from '../../composition/platform-reference-readers.module';
import { OpsPrivacyController } from './api/trust/audit-privacy.controller';
import { PrivacyOperationsService } from './application/trust/privacy-operations.service';
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
  controllers: [OpsPrivacyController],
  providers: [PrivacyOperationsService],
  exports: [PrivacyOperationsService],
})
export class PlatformPrivacyModule {}
