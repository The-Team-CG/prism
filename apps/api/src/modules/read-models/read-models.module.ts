import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/kernel/database';
import { AccessControlModule } from '@prism/kernel/access-control';
import { EventLifecycleModule } from '../event-lifecycle/event-lifecycle.module';
import { FloorplanModule } from '../floorplan/floorplan.module';
import { OperationsModule } from '../operations/operations.module';
import { IdentityAccessModule } from '../identity-access/identity-access.module';
import { EventSessionModule } from '@prism/kernel/event-session';
import { CommercialModule } from '../commercial/commercial.module';
import { PlatformOpsModule } from '../platform-ops/platform-ops.module';
import { OpsBillingController } from './api/billing.controller';
import { OpsClientController } from './api/client-workspace.controller';
import { OpsDefenseReadinessController } from './api/defense-readiness.controller';
import { OpsEventReadsController } from './api/events.controller';
import { OpsPmcmCommandInboxController } from './api/pmcm-command-inbox.controller';
import { OpsPmcmDashboardController } from './api/pmcm-dashboard.controller';
import { OpsSupplierWorkspaceReadsController } from './api/supplier-workspace.controller';
import {
  BILLING_READ_MODEL,
  CLIENT_EVENT_READ_MODEL,
  PMCM_EVENT_READ_MODEL,
  SUPPLIER_EVENT_READ_MODEL,
} from './contracts/ports/event-read-models.tokens';
import { EventReadModelQueries } from './application/queries/event-read-models.queries';
import { EventReadModelsService } from './application/services/event-read-models.service';
import { LiveOpsReadModelsService } from './application/services/live-ops-read-models.service';
import { PlatformReferenceReadModelsService } from './application/services/platform-reference-read-models.service';
import { LIVE_OPS_READ_MODEL } from './contracts/ports/live-ops-read-models.tokens';
import { GuestEventProjectionModule } from './guest-event-projection.module';
import { GuestPassDeliveryEligibilityModule } from './guest-pass-delivery-eligibility/guest-pass-delivery-eligibility.module';
import { CommercialFactsReaderModule } from './commercial-facts-reader.module';

/**
 * Read-only composition context. It owns no writes and composes the public
 * reader ports exposed by the bounded contexts that own the underlying tables.
 */
@Module({
  imports: [
    DatabaseModule,
    EventSessionModule,
    AccessControlModule,
    OperationsModule,
    CommercialModule,
    FloorplanModule,
    PlatformOpsModule,
    EventLifecycleModule,
    IdentityAccessModule,
    GuestEventProjectionModule,
    GuestPassDeliveryEligibilityModule,
    CommercialFactsReaderModule,
  ],
  controllers: [
    OpsBillingController,
    OpsClientController,
    OpsDefenseReadinessController,
    OpsEventReadsController,
    OpsPmcmCommandInboxController,
    OpsPmcmDashboardController,
    OpsSupplierWorkspaceReadsController,
  ],
  providers: [
    EventReadModelQueries,
    EventReadModelsService,
    LiveOpsReadModelsService,
    PlatformReferenceReadModelsService,
    { provide: LIVE_OPS_READ_MODEL, useExisting: LiveOpsReadModelsService },
    { provide: PMCM_EVENT_READ_MODEL, useExisting: EventReadModelsService },
    { provide: CLIENT_EVENT_READ_MODEL, useExisting: EventReadModelsService },
    { provide: SUPPLIER_EVENT_READ_MODEL, useExisting: EventReadModelsService },
    { provide: BILLING_READ_MODEL, useExisting: EventReadModelsService },
  ],
  exports: [
    EventReadModelQueries,
    EventReadModelsService,
    PMCM_EVENT_READ_MODEL,
    CLIENT_EVENT_READ_MODEL,
    SUPPLIER_EVENT_READ_MODEL,
    BILLING_READ_MODEL,
    LIVE_OPS_READ_MODEL,
    PlatformReferenceReadModelsService,
    GuestEventProjectionModule,
    GuestPassDeliveryEligibilityModule,
    CommercialFactsReaderModule,
  ],
})
export class ReadModelsModule {}
