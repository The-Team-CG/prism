import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/database';
import { EventCoreModule } from '@prism/modules/event-core';
import { NotificationOpsModule } from '@prism/modules/notification-ops';
import { TrustOpsModule } from '@prism/modules/trust-ops';
import { COMMERCIAL_WORKFLOW_COMMANDS, PROPOSAL_READER, QUOTE_SUPPLIER_RESOLVER } from './ports/commercial-ops.tokens';
import { CommercialWorkflowService } from './services/commercial-workflow.service';
import { PrismaQuoteSupplierResolver } from './services/prisma-quote-supplier-resolver.service';

@Module({
  imports: [DatabaseModule, EventCoreModule, TrustOpsModule, NotificationOpsModule],
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