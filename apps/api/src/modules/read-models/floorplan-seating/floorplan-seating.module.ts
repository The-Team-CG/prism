import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/kernel/database';
import { FLOORPLAN_SEATING_FACTS } from './floorplan-seating.port';
import { FloorplanSeatingFactsService } from './floorplan-seating.service';

/** Small read-only composition module for floor plan saves; deliberately imports no domain modules. */
@Module({
  imports: [DatabaseModule],
  providers: [FloorplanSeatingFactsService, { provide: FLOORPLAN_SEATING_FACTS, useExisting: FloorplanSeatingFactsService }],
  exports: [FLOORPLAN_SEATING_FACTS],
})
export class FloorplanSeatingFactsModule {}
