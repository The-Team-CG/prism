import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/kernel/database';
import { AccessControlModule } from '@prism/kernel/access-control';
import { PlatformOpsModule } from '@prism/contexts/platform-ops';
import { CommercialModule } from '@prism/contexts/commercial';
import { EventCoreModule } from '@prism/kernel/event-core';
import { ReadModelsModule } from '@prism/contexts/read-models';
import { EventLifecycleModule } from '@prism/contexts/event-lifecycle';
import { FloorplanModule } from '@prism/contexts/floorplan';
import { OperationsModule } from '@prism/contexts/operations';
import { IdentityAccessModule } from '@prism/contexts/identity-access';
import { LiveOpsModule } from '@prism/contexts/live-ops';
import { EventSessionModule } from '@prism/kernel/event-session';
import { SAMPLE_COMPATIBILITY_CONTROLLERS } from './controllers';
import { SampleResetGuard } from './guards/sample-reset.guard';
import { SampleCompatibilityService } from './services/sample-compatibility.service';
import { SampleStateService } from './services/sample-state.service';

/**
 * Owned tables: none.
 * Read-only: none.
 *
 * Legacy `/sample/*` compatibility layer only: seeds and reads nearly every model in the schema for local/demo bootstrapping. Not counted as a real owner for any model above; every model it touches is owned by its real domain module.
 */
@Module({
  imports: [
    DatabaseModule,
    EventCoreModule,
    // Depended on directly by SampleResetGuard. Previously reached only
    // transitively via IdentityAccessModule's re-export; naming it here keeps the
    // guard working if that re-export is ever tightened (cf. PA-280).
    EventSessionModule,
    PlatformOpsModule,
    AccessControlModule,
    IdentityAccessModule,
    EventLifecycleModule,
    CommercialModule,
    FloorplanModule,
    OperationsModule,
    LiveOpsModule,
    ReadModelsModule,
  ],
  controllers: SAMPLE_COMPATIBILITY_CONTROLLERS,
  providers: [SampleStateService, SampleCompatibilityService, SampleResetGuard],
})
export class SampleCompatibilityModule {}
