import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/database';
import { PrismTransactionRunner } from '../../../core/shared-kernel/src';
import { WORKFLOW_COMMAND_LOG } from './ports/workflow-command-log.tokens';
import { EventLifecycleService } from './services/event-lifecycle.service';
import { WorkflowCommandService } from './services/workflow-command.service';

const workflowCommandLogProvider = {
  provide: WORKFLOW_COMMAND_LOG,
  useExisting: WorkflowCommandService,
};

@Module({
  imports: [DatabaseModule],
  providers: [PrismTransactionRunner, EventLifecycleService, WorkflowCommandService, workflowCommandLogProvider],
  exports: [PrismTransactionRunner, EventLifecycleService, WorkflowCommandService, workflowCommandLogProvider],
})
export class EventCoreModule {}