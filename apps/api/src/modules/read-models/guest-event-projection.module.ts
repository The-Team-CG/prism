import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/kernel/database';
import { GUEST_EVENT_PROJECTION_READER } from './contracts/ports/guest-event-projection.port';
import { GuestEventProjectionService } from './application/services/guest-event-projection.service';

/** Small read-model capability imported without the full read-model composition root. */
@Module({
  imports: [DatabaseModule],
  providers: [
    GuestEventProjectionService,
    { provide: GUEST_EVENT_PROJECTION_READER, useExisting: GuestEventProjectionService },
  ],
  exports: [GUEST_EVENT_PROJECTION_READER],
})
export class GuestEventProjectionModule {}