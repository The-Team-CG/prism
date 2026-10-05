import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/kernel/database';
import { PrismTransactionRunner } from '@prism/kernel/shared-kernel';
import { WORKFLOW_COMMAND_LOG } from './ports/workflow-command-log.tokens';
import { EventLifecycleService } from './services/event-lifecycle.service';
import { WorkflowCommandService } from './services/workflow-command.service';

const workflowCommandLogProvider = {
  provide: WORKFLOW_COMMAND_LOG,
  useExisting: WorkflowCommandService,
};

/**
 * Kernel-owned command coordination. Receipt persistence is supplied by the
 * Platform composition module through the CommandReceiptStore port.
 */
@Module({
  imports: [DatabaseModule],
  providers: [
    PrismTransactionRunner,
    EventLifecycleService,
    WorkflowCommandService,
    workflowCommandLogProvider,
  ],
  exports: [
    PrismTransactionRunner,
    EventLifecycleService,
    WorkflowCommandService,
    workflowCommandLogProvider,
  ],
})
export class EventCoreModule {}
