import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/kernel/database';
import { AccessControlModule } from '@prism/kernel/access-control';
import { PlatformOpsModule } from '../platform-ops/platform-ops.module';
import { EventCoreModule } from '@prism/kernel/event-core';
import { EventSessionModule } from '@prism/kernel/event-session';
import { DOCUMENT_VAULT } from '../event-lifecycle/contracts/document-vault.port';
import { EventLifecycleModule } from '../event-lifecycle/event-lifecycle.module';
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
import { COMMERCIAL_WORKFLOW_COMMANDS, PROPOSAL_READER, QUOTE_SUPPLIER_RESOLVER } from './contracts/commercial-ops.tokens';
import {
  SUPPLIER_COMMANDS,
  SUPPLIER_DIRECTORY,
  SUPPLIER_DOCUMENT_VAULT,
} from './contracts/supplier-ops.tokens';
import { PAYMENT_STATUS_READER } from './contracts/finance-ops.tokens';
import { CommercialWorkflowService } from './application/quotes/commercial-workflow.service';
import { PrismaQuoteSupplierResolver } from './application/quotes/prisma-quote-supplier-resolver.service';
import { SupplierApplicationService } from './application/suppliers/supplier-application.service';
import { SupplierNetworkWorkflowService } from './application/suppliers/supplier-network-workflow.service';
import { SupplierProfileCommandsService } from './application/suppliers/supplier-profile-commands.service';
import { SuppliersService } from './application/suppliers/suppliers.service';
import { BillingOperationsService } from './application/billing/billing-operations.service';
import { PaymentOperationsService } from './application/billing/payment-operations.service';
import { PaymentRiskScheduler } from './application/billing/payment-risk.scheduler';
import { CommunicationController } from './api/suppliers/communication.controller';
import { CommunicationService } from './application/suppliers/communication.service';
import { IdentityAccessModule } from '../identity-access/identity-access.module';
import { ProposalLifecycleController } from './api/quotes/proposal-lifecycle.controller';
import { ProposalLifecycleService } from './application/quotes/proposal-lifecycle.service';

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
 * Owned tables: OpsSupplierQuote, OpsSupplierQuoteRequest, OpsDocument
 * (supplier document kinds), OpsSupplier, OpsSupplierApplication,
 * OpsSupplierCertification, OpsSupplierReview, OpsSupplierReliabilityNote,
 * OpsBillingSource,
 * OpsBillingStatement, OpsDocument (billing-related documents only;
 * OpsDocument is also owned by inquiry-onboarding for its own document
 * kinds), OpsPaymentMilestone, OpsPaymentRecord.
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
    { provide: PROPOSAL_READER, useExisting: CommercialWorkflowService },
    { provide: QUOTE_SUPPLIER_RESOLVER, useExisting: PrismaQuoteSupplierResolver },
    SuppliersService,
    SupplierApplicationService,
    supplierDirectoryProvider,
    SupplierProfileCommandsService,
    SupplierNetworkWorkflowService,
    supplierCommandsProvider,
    { provide: SUPPLIER_DOCUMENT_VAULT, useExisting: DOCUMENT_VAULT },
    BillingOperationsService,
    PaymentOperationsService,
    PaymentRiskScheduler,
    CommunicationService,
    ProposalLifecycleService,
    { provide: PAYMENT_STATUS_READER, useExisting: PaymentOperationsService },
  ],
  exports: [
    CommercialWorkflowService,
    COMMERCIAL_WORKFLOW_COMMANDS,
    PROPOSAL_READER,
    QUOTE_SUPPLIER_RESOLVER,
    SuppliersService,
    supplierDirectoryProvider,
    supplierCommandsProvider,
    SupplierProfileCommandsService,
    SupplierNetworkWorkflowService,
    SUPPLIER_COMMANDS,
    BillingOperationsService,
    PAYMENT_STATUS_READER,
  ],
})
export class CommercialModule {}
