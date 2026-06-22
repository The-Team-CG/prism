import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/database';
import { AccessControlModule } from '@prism/modules/access-control';
import { EventCoreModule } from '@prism/modules/event-core';
import { FloorplanModule } from '@prism/modules/floorplan';
import { GuestOpsModule } from '@prism/modules/guest-ops';
import { NotificationOpsModule } from '@prism/modules/notification-ops';
import { StaffingOpsModule } from '@prism/modules/staffing-ops';
import { SUPPLIER_LIVE_OPERATIONS, SupplierOpsModule } from '@prism/modules/supplier-ops';
import { TrustOpsModule } from '@prism/modules/trust-ops';
import { EventLiveOpsCommandService } from './services/event-live-ops-command.service';
import { EventLiveOpsReadService } from './services/event-live-ops-read.service';
import { LiveOperationsService } from './services/live-operations.service';

@Module({
  imports: [
    DatabaseModule,
    AccessControlModule,
    EventCoreModule,
    TrustOpsModule,
    NotificationOpsModule,
    StaffingOpsModule,
    FloorplanModule,
    GuestOpsModule,
    SupplierOpsModule,
  ],
  providers: [
    LiveOperationsService,
    EventLiveOpsReadService,
    EventLiveOpsCommandService,
    { provide: SUPPLIER_LIVE_OPERATIONS, useExisting: LiveOperationsService },
  ],
  exports: [LiveOperationsService, EventLiveOpsReadService, EventLiveOpsCommandService, SUPPLIER_LIVE_OPERATIONS],
})
export class LiveOpsModule {}
