import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/database';
import { EVENT_OPS_CONTROLLERS } from './controllers';
import { EventOpsService } from './event-ops.service';
import { DemoStateService } from './services/demo-state.service';
import { InquiryWorkflowService } from './services/inquiry-workflow.service';

@Module({
  imports: [DatabaseModule],
  controllers: EVENT_OPS_CONTROLLERS,
  providers: [EventOpsService, DemoStateService, InquiryWorkflowService],
})
export class EventOpsModule {}
