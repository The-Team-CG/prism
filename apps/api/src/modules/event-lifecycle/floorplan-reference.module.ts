import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/kernel/database';
import { FLOORPLAN_EVENT_REFERENCE_READER } from './contracts/floorplan-event-reference.port';
import { FloorplanEventReferenceService } from './application/onboarding/floorplan-event-reference.service';

/** Lifecycle owner capability for Floorplan event gates and current-state projection. */
@Module({
  imports: [DatabaseModule],
  providers: [
    FloorplanEventReferenceService,
    { provide: FLOORPLAN_EVENT_REFERENCE_READER, useExisting: FloorplanEventReferenceService },
  ],
  exports: [FLOORPLAN_EVENT_REFERENCE_READER],
})
export class FloorplanReferenceModule {}
