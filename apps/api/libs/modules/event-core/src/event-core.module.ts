import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/database';
import { PrismTransactionRunner } from '../../../core/shared-kernel/src';
import { WORKFLOW_COMMAND_LOG } from './ports/workflow-command-log.tokens';
import { WorkflowCommandService } from './services/workflow-command.service';

const workflowCommandLogProvider = {
  provide: WORKFLOW_COMMAND_LOG,
  useExisting: WorkflowCommandService,
};

@Module({
  imports: [DatabaseModule],
  providers: [PrismTransactionRunner, WorkflowCommandService, workflowCommandLogProvider],
  exports: [PrismTransactionRunner, WorkflowCommandService, workflowCommandLogProvider],
})
export class EventCoreModule {}