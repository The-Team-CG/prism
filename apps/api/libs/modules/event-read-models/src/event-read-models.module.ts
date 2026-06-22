import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/database';
import { AccessControlModule } from '@prism/modules/access-control';
import { FinanceOpsModule } from '@prism/modules/finance-ops';
import { GuestOpsModule } from '@prism/modules/guest-ops';
import { StaffingOpsModule } from '@prism/modules/staffing-ops';
import { TrustOpsModule } from '@prism/modules/trust-ops';
import { OpsBillingController } from './controllers/billing.controller';
import { OpsClientController } from './controllers/client-workspace.controller';
import { BILLING_READ_MODEL, CLIENT_EVENT_READ_MODEL, PMCM_EVENT_READ_MODEL, SUPPLIER_EVENT_READ_MODEL } from './ports/event-read-models.tokens';
import { EventReadModelQueries } from './queries/event-read-models.queries';
import { EventReadModelsService } from './services/event-read-models.service';

@Module({
  imports: [DatabaseModule, AccessControlModule, GuestOpsModule, StaffingOpsModule, FinanceOpsModule, TrustOpsModule],
  controllers: [OpsBillingController, OpsClientController],
  providers: [
    EventReadModelQueries,
    EventReadModelsService,
    { provide: PMCM_EVENT_READ_MODEL, useExisting: EventReadModelsService },
    { provide: CLIENT_EVENT_READ_MODEL, useExisting: EventReadModelsService },
    { provide: SUPPLIER_EVENT_READ_MODEL, useExisting: EventReadModelsService },
    { provide: BILLING_READ_MODEL, useExisting: EventReadModelsService },
  ],
  exports: [
    EventReadModelsService,
    PMCM_EVENT_READ_MODEL,
    CLIENT_EVENT_READ_MODEL,
    SUPPLIER_EVENT_READ_MODEL,
    BILLING_READ_MODEL,
  ],
})
export class EventReadModelsModule {}