import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/database';
import { AccessControlModule } from '@prism/modules/access-control';
import { EventCoreModule } from '@prism/modules/event-core';
import { NotificationOpsModule } from '@prism/modules/notification-ops';
import { TrustOpsModule } from '@prism/modules/trust-ops';
import { OpsEventCommercialController } from './controllers/event-commercial.controller';
import { OpsQuoteRequestsController } from './controllers/quote-requests.controller';
import { COMMERCIAL_WORKFLOW_COMMANDS, PROPOSAL_READER, QUOTE_SUPPLIER_RESOLVER } from './ports/commercial-ops.tokens';
import { CommercialWorkflowService } from './services/commercial-workflow.service';
import { PrismaQuoteSupplierResolver } from './services/prisma-quote-supplier-resolver.service';

/**
 * Owned tables: OpsSupplierQuote, OpsSupplierQuoteRequest.
 * Read-only: OpsEvent (via inquiry-onboarding), OpsSupplier (via supplier-ops), OpsSupplierCategory (sample-seeded only; no owning module).
 */
@Module({
  imports: [DatabaseModule, AccessControlModule, EventCoreModule, TrustOpsModule, NotificationOpsModule],
  controllers: [OpsQuoteRequestsController, OpsEventCommercialController],
  providers: [
    CommercialWorkflowService,
    PrismaQuoteSupplierResolver,
    { provide: COMMERCIAL_WORKFLOW_COMMANDS, useExisting: CommercialWorkflowService },
    { provide: PROPOSAL_READER, useExisting: CommercialWorkflowService },
    { provide: QUOTE_SUPPLIER_RESOLVER, useExisting: PrismaQuoteSupplierResolver },
  ],
  exports: [CommercialWorkflowService, COMMERCIAL_WORKFLOW_COMMANDS, PROPOSAL_READER, QUOTE_SUPPLIER_RESOLVER],
})
export class CommercialOpsModule {}
