import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/database';
import { EVENT_OPS_CONTROLLERS } from './controllers';
import { EventOpsService } from './event-ops.service';

@Module({
  imports: [DatabaseModule],
  controllers: EVENT_OPS_CONTROLLERS,
  providers: [EventOpsService],
})
export class EventOpsModule {}
