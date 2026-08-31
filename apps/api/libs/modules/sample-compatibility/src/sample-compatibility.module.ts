import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/database';
import { AccessControlModule } from '@prism/modules/access-control';
import { AiGovernanceModule } from '@prism/modules/ai-governance';
import { ClosureOpsModule } from '@prism/modules/closure-ops';
import { CommercialOpsModule } from '@prism/modules/commercial-ops';
import { ComplianceOpsModule } from '@prism/modules/compliance-ops';
import { EventCoreModule } from '@prism/modules/event-core';
import { EventReadModelsModule } from '@prism/modules/event-read-models';
import { FileOpsModule } from '@prism/modules/file-ops';
import { FinanceOpsModule } from '@prism/modules/finance-ops';
import { FloorplanModule } from '@prism/contexts/floorplan';
import { OperationsModule } from '@prism/contexts/operations';
import { IdentityOpsModule } from '@prism/modules/identity-ops';
import { InquiryOnboardingModule } from '@prism/modules/inquiry-onboarding';
import { LiveOpsModule } from '@prism/contexts/live-ops';
import { NotificationOpsModule } from '@prism/modules/notification-ops';
import { SupplierOpsModule } from '@prism/modules/supplier-ops';
import { TrustOpsModule } from '@prism/modules/trust-ops';
import { EventSessionModule } from '@prism/modules/event-session';
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
    // transitively via IdentityOpsModule's re-export; naming it here keeps the
    // guard working if that re-export is ever tightened (cf. PA-280).
    EventSessionModule,
    TrustOpsModule,
    NotificationOpsModule,
    AccessControlModule,
    IdentityOpsModule,
    InquiryOnboardingModule,
    CommercialOpsModule,
    ComplianceOpsModule,
    FloorplanModule,
    FileOpsModule,
    FinanceOpsModule,
    OperationsModule,
    SupplierOpsModule,
    AiGovernanceModule,
    LiveOpsModule,
    ClosureOpsModule,
    EventReadModelsModule,
  ],
  controllers: SAMPLE_COMPATIBILITY_CONTROLLERS,
  providers: [SampleStateService, SampleCompatibilityService, SampleResetGuard],
})
export class SampleCompatibilityModule {}
