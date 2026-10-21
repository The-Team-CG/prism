import { Module } from '@nestjs/common';
import { AuthSessionService } from './services/auth-session.service';
import { EventSessionGuard } from './guards/event-session.guard';
import { DatabaseModule } from '@prism/kernel/database';

/**
 * Owned tables: none.
 * Read-only: none.
 */
@Module({
  imports: [DatabaseModule],
  providers: [AuthSessionService, EventSessionGuard],
  exports: [AuthSessionService, EventSessionGuard],
})
export class EventSessionModule {}
