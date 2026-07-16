import { Module } from '@nestjs/common';
import { AuthSessionService } from './services/auth-session.service';
import { EventSessionGuard } from './guards/event-session.guard';

@Module({
  providers: [AuthSessionService, EventSessionGuard],
  exports: [AuthSessionService, EventSessionGuard],
})
export class EventSessionModule {}
