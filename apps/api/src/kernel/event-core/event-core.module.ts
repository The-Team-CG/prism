import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/kernel/database';
import { PrismTransactionRunner } from '@prism/kernel/shared-kernel';
import { COMMAND_RECEIPT_STORE, WORKFLOW_COMMAND_LOG } from './ports/workflow-command-log.tokens';
import { EventLifecycleService } from './services/event-lifecycle.service';
import { PrismaCommandReceiptStore } from './services/prisma-command-receipt.store';
import { WorkflowCommandService } from './services/workflow-command.service';

const workflowCommandLogProvider = {
  provide: WORKFLOW_COMMAND_LOG,
  useExisting: WorkflowCommandService,
};

const commandReceiptStoreProvider = {
  provide: COMMAND_RECEIPT_STORE,
  useExisting: PrismaCommandReceiptStore,
};

/**
 * Owned tables: trust_ops.command_receipts.
 * Read-only: none.
 */
@Module({
  imports: [DatabaseModule],
  providers: [
    PrismTransactionRunner,
    EventLifecycleService,
    PrismaCommandReceiptStore,
    WorkflowCommandService,
    workflowCommandLogProvider,
    commandReceiptStoreProvider,
  ],
  exports: [
    PrismTransactionRunner,
    EventLifecycleService,
    WorkflowCommandService,
    workflowCommandLogProvider,
    commandReceiptStoreProvider,
  ],
})
export class EventCoreModule {}
