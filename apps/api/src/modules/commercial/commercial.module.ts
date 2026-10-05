import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/kernel/database';
import { AccessControlModule } from '@prism/kernel/access-control';
import { PlatformOpsModule } from '../platform-ops/platform-ops.module';
import { EventCoreModule } from '@prism/kernel/event-core';
import { EventSessionModule } from '@prism/kernel/event-session';
import { DOCUMENT_VAULT } from '@prism/contexts/event-lifecycle';
import { EventLifecycleModule } from '../event-lifecycle/event-lifecycle.module';
import { UrgentIssueReferenceModule } from '@prism/contexts/live-ops/urgent-issue-reference';
import { OpsEventCommercialController } from './api/quotes/event-commercial.controller';
import { OpsEventProposalReviewController } from './api/quotes/event-proposal-review.controller';
import { ProposalClientReviewService } from './application/quotes/proposal-client-review.service';
import { OpsQuoteRequestsController } from './api/quotes/quote-requests.controller';
import { OpsEventSupplierWithdrawalController } from './api/suppliers/event-supplier-withdrawal.controller';
import { OpsSupplierApplicationsController } from './api/suppliers/supplier-applications.controller';
import { OpsSupplierDirectoryController } from './api/suppliers/supplier-directory.controller';
import { OpsSupplierPareController } from './api/suppliers/supplier-pare.controller';
import { OpsSupplierWorkspaceCommandsController } from './api/suppliers/supplier-workspace-commands.controller';
import { OpsSuppliersController } from './api/suppliers/suppliers.controller';
import { OpsEventBillingController } from './api/billing/event-billing.controller';
import { COMMERCIAL_WORKFLOW_COMMANDS, QUOTE_SUPPLIER_RESOLVER } from './contracts/commercial-ops.tokens';
import {
  SUPPLIER_COMMANDS,
  SUPPLIER_DIRECTORY,
} from './contracts/supplier-ops.tokens';
import { PAYMENT_STATUS_READER } from './contracts/finance-ops.tokens';
import { CommercialWorkflowService } from './application/quotes/commercial-workflow.service';
import { PrismaQuoteSupplierResolver } from './application/quotes/prisma-quote-supplier-resolver.service';
import { SupplierApplicationService } from './application/suppliers/supplier-application.service';
import { SupplierNetworkWorkflowService } from './application/suppliers/supplier-network-workflow.service';
import { SupplierIngressLateMonitorService } from './application/suppliers/supplier-ingress-late-monitor.service';
import { SupplierIngressLateScheduler } from './application/suppliers/supplier-ingress-late.scheduler';
import { SupplierProfileCommandsService } from './application/suppliers/supplier-profile-commands.service';
import { SuppliersService } from './application/suppliers/suppliers.service';
import { BillingOperationsService } from './application/billing/billing-operations.service';
import { BillingAdjustmentService } from './application/billing/billing-adjustment.service';
import { PaymentOperationsService } from './application/billing/payment-operations.service';
import { PaymentRiskScheduler } from './application/billing/payment-risk.scheduler';
import { CommunicationController } from './api/suppliers/communication.controller';
import { CommunicationService } from './application/suppliers/communication.service';
import { IdentityAccessModule } from '../identity-access/identity-access.module';
import { ProposalLifecycleController } from './api/quotes/proposal-lifecycle.controller';
import { ProposalLifecycleService } from './application/quotes/proposal-lifecycle.service';
import { CommercialPrivacyRedactorService } from './application/suppliers/commercial-privacy-redactor.service';
import { COMMERCIAL_PRIVACY_REDACTOR } from './contracts/privacy-redaction.port';
import { CommercialAddendumImpactModule } from './commercial-addendum-impact.module';

const supplierDirectoryProvider = {
  provide: SUPPLIER_DIRECTORY,
  useExisting: SuppliersService,
};

const supplierCommandsProvider = {
  provide: SUPPLIER_COMMANDS,
  useExisting: SupplierNetworkWorkflowService,
};

/**
 * Bounded-context composition root for commercial: the supplier
 * sourcing -> quote -> billing pipeline. Merged from the former
 * `commercial-ops`, `supplier-ops`, and `finance-ops` Nest library modules
 * (2026-09-01) — same event-commerce lifecycle, split by former CRUD
 * ownership rather than by capability. Kept as three sub-areas
 * (`quotes`, `suppliers`, `billing`) under one context. `commercial-ops`'s
 * existing `domain/` folder (quote-request lifecycle policy) moves in
 * unchanged.
 *
 * Owned tables: OpsSupplierQuote, OpsSupplierQuoteRequest, OpsSupplier,
 * OpsSupplierApplication,
 * OpsSupplierCertification, OpsSupplierReview, OpsSupplierReliabilityNote,
 * OpsBillingSource,
 * OpsBillingStatement, OpsPaymentMilestone, OpsPaymentRecord. Lifecycle owns
 * all OpsDocument metadata and exposes the document-vault capability.
 * Read-only: OpsEvent (via inquiry-onboarding), OpsSupplierCategory
 * (populated only by local fixtures; no owning module), OpsSupplierReviewDimension
 * (populated only by local fixtures; no owning module), OpsInquiry (via
 * inquiry-onboarding).
 */
@Module({
  imports: [
    DatabaseModule,
    AccessControlModule,
    PlatformOpsModule,
    EventCoreModule,
    EventLifecycleModule,
    UrgentIssueReferenceModule,
    CommercialAddendumImpactModule,
    EventSessionModule,
    IdentityAccessModule,
  ],
  controllers: [
    OpsQuoteRequestsController,
    OpsEventCommercialController,
    OpsEventProposalReviewController,
    OpsEventSupplierWithdrawalController,
    OpsSupplierApplicationsController,
    OpsSupplierDirectoryController,
    OpsSuppliersController,
    OpsSupplierWorkspaceCommandsController,
    OpsSupplierPareController,
    OpsEventBillingController,
    CommunicationController,
    ProposalLifecycleController,
  ],
  providers: [
    CommercialWorkflowService,
    ProposalClientReviewService,
    PrismaQuoteSupplierResolver,
    { provide: COMMERCIAL_WORKFLOW_COMMANDS, useExisting: CommercialWorkflowService },
    { provide: QUOTE_SUPPLIER_RESOLVER, useExisting: PrismaQuoteSupplierResolver },
    SuppliersService,
    SupplierApplicationService,
    supplierDirectoryProvider,
    SupplierProfileCommandsService,
    SupplierNetworkWorkflowService,
    SupplierIngressLateMonitorService,
    SupplierIngressLateScheduler,
    supplierCommandsProvider,
    BillingOperationsService,
    BillingAdjustmentService,
    PaymentOperationsService,
    PaymentRiskScheduler,
    CommunicationService,
    ProposalLifecycleService,
    CommercialPrivacyRedactorService,
    { provide: COMMERCIAL_PRIVACY_REDACTOR, useExisting: CommercialPrivacyRedactorService },
    { provide: PAYMENT_STATUS_READER, useExisting: PaymentOperationsService },
  ],
  exports: [
    CommercialWorkflowService,
    COMMERCIAL_WORKFLOW_COMMANDS,
    SuppliersService,
    supplierDirectoryProvider,
    supplierCommandsProvider,
    SupplierProfileCommandsService,
    SupplierNetworkWorkflowService,
    SUPPLIER_COMMANDS,
    BillingOperationsService,
    PAYMENT_STATUS_READER,
    COMMERCIAL_PRIVACY_REDACTOR,
    CommercialAddendumImpactModule,
  ],
})
export class CommercialModule {}
