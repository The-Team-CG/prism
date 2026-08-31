import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/database';
import { AccessControlModule } from '@prism/modules/access-control';
import { ClosureOpsModule } from '@prism/modules/closure-ops';
import { FinanceOpsModule } from '@prism/modules/finance-ops';
import { FloorplanModule } from '@prism/contexts/floorplan';
import { OperationsModule } from '@prism/contexts/operations';
import { IdentityOpsModule } from '@prism/modules/identity-ops';
import { CommercialOpsModule } from '@prism/modules/commercial-ops';
import { TrustOpsModule } from '@prism/modules/trust-ops';
import { OpsBillingController } from './controllers/billing.controller';
import { OpsClientController } from './controllers/client-workspace.controller';
import { OpsDefenseReadinessController } from './controllers/defense-readiness.controller';
import { OpsEventReadsController } from './controllers/events.controller';
import { OpsPmcmCommandInboxController } from './controllers/pmcm-command-inbox.controller';
import { OpsPmcmDashboardController } from './controllers/pmcm-dashboard.controller';
import { OpsSupplierWorkspaceReadsController } from './controllers/supplier-workspace.controller';
import { BILLING_READ_MODEL, CLIENT_EVENT_READ_MODEL, PMCM_EVENT_READ_MODEL, SUPPLIER_EVENT_READ_MODEL } from './ports/event-read-models.tokens';
import { EventReadModelQueries } from './queries/event-read-models.queries';
import { EventReadModelsService } from './services/event-read-models.service';
import { LiveOpsReadModelsService } from './services/live-ops-read-models.service';
import { LIVE_OPS_READ_MODEL } from './ports/live-ops-read-models.tokens';

/**
 * Owned tables: none.
 * Read-only: OpsAuditLog (via trust-ops), OpsBillingSource (via finance-ops, inquiry-onboarding), OpsBillingStatement (via finance-ops, inquiry-onboarding), OpsBriefing (via inquiry-onboarding), OpsComplianceCheck (via compliance-ops), OpsComplianceRule (via compliance-ops), OpsCoordinator (sample-seeded only; no owning module), OpsCoordinatorAssignment (via live-ops, staffing-ops), OpsDocument (via finance-ops, inquiry-onboarding, supplier-ops), OpsEvent (via inquiry-onboarding), OpsEventDayLog (via live-ops), OpsEventDayTask (via live-ops), OpsEventInsight (via closure-ops), OpsFloorPlanDraft (via floorplan), OpsInquiry (via inquiry-onboarding), OpsNotificationLog (via notification-ops, trust-ops), OpsPaymentMilestone (via finance-ops, inquiry-onboarding), OpsPaymentRecord (via finance-ops), OpsPostEventDocument (via inquiry-onboarding), OpsSupplierQuote (via commercial-ops), OpsSupplierQuoteRequest (via commercial-ops), OpsUrgentIssue (via live-ops), OpsUser (via identity-ops).
 *
 * Read-only-by-design reader module: composes cross-domain read models from every writer module above, owns no writes.
 */
@Module({
  imports: [DatabaseModule, AccessControlModule, OperationsModule, FinanceOpsModule, FloorplanModule, TrustOpsModule, ClosureOpsModule, IdentityOpsModule, CommercialOpsModule],
  controllers: [OpsBillingController, OpsClientController, OpsDefenseReadinessController, OpsEventReadsController, OpsPmcmCommandInboxController, OpsPmcmDashboardController, OpsSupplierWorkspaceReadsController],
  providers: [
    EventReadModelQueries,
    EventReadModelsService,
    LiveOpsReadModelsService,
    { provide: LIVE_OPS_READ_MODEL, useExisting: LiveOpsReadModelsService },
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
    LIVE_OPS_READ_MODEL,
  ],
})
export class EventReadModelsModule {}
