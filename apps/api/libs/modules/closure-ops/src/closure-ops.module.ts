import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/database';
import { AccessControlModule } from '@prism/modules/access-control';
import { EventCoreModule } from '@prism/modules/event-core';
import { FileOpsModule } from '@prism/modules/file-ops';
import { FloorplanModule } from '@prism/contexts/floorplan';
import { OperationsModule } from '@prism/contexts/operations';
import { NotificationOpsModule } from '@prism/modules/notification-ops';
import { TrustOpsModule } from '@prism/modules/trust-ops';
import { OpsEventClosureController } from './controllers/event-closure.controller';
import { CLOSURE_COMMANDS, CLOSURE_READINESS_READER } from './ports/closure-ops.tokens';
import { EventClosureService } from './services/event-closure.service';

/**
 * Owned tables: OpsEventInsight.
 * Read-only: OpsBillingStatement (via finance-ops), OpsComplianceCheck (via compliance-ops), OpsDocument (via finance-ops, inquiry-onboarding, supplier-ops), OpsEvent (via inquiry-onboarding), OpsPaymentMilestone (via finance-ops), OpsPostEventDocument (via inquiry-onboarding), OpsSupplierReview (via supplier-ops).
 */
@Module({
  imports: [
    DatabaseModule,
    EventCoreModule,
    TrustOpsModule,
    AccessControlModule,
    NotificationOpsModule,
    FileOpsModule,
    OperationsModule,
    FloorplanModule,
  ],
  controllers: [OpsEventClosureController],
  providers: [
    EventClosureService,
    { provide: CLOSURE_COMMANDS, useExisting: EventClosureService },
    { provide: CLOSURE_READINESS_READER, useExisting: EventClosureService },
  ],
  exports: [EventClosureService, CLOSURE_COMMANDS, CLOSURE_READINESS_READER],
})
export class ClosureOpsModule {}
