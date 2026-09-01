import { Module } from '@nestjs/common';
import { AuthSessionService } from './services/auth-session.service';
import { EventSessionGuard } from './guards/event-session.guard';

/**
 * Owned tables: none.
 * Read-only: none.
 */
@Module({
  providers: [AuthSessionService, EventSessionGuard],
  exports: [AuthSessionService, EventSessionGuard],
})
export class EventSessionModule {}
