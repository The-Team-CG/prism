import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/kernel/database';
import { FLOORPLAN_PROJECTION_WRITER } from './contracts/floorplan-projection.port';
import { FloorplanProjectionService } from './application/floorplan-projection.service';

/** Narrow Lifecycle owner capability module with no dependency on Operations or Floorplan. */
@Module({
  imports: [DatabaseModule],
  providers: [FloorplanProjectionService, { provide: FLOORPLAN_PROJECTION_WRITER, useExisting: FloorplanProjectionService }],
  exports: [FLOORPLAN_PROJECTION_WRITER],
})
export class EventLifecycleProjectionModule {}
