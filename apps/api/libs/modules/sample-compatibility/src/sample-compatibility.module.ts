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
import { FloorplanModule } from '@prism/modules/floorplan';
import { GuestOpsModule } from '@prism/modules/guest-ops';
import { IdentityOpsModule } from '@prism/modules/identity-ops';
import { InquiryOnboardingModule } from '@prism/modules/inquiry-onboarding';
import { LiveOpsModule } from '@prism/modules/live-ops';
import { NotificationOpsModule } from '@prism/modules/notification-ops';
import { StaffingOpsModule } from '@prism/modules/staffing-ops';
import { SupplierOpsModule } from '@prism/modules/supplier-ops';
import { TrustOpsModule } from '@prism/modules/trust-ops';
import { SampleController } from './controllers/sample.controller';
import { SampleCompatibilityService } from './services/sample-compatibility.service';
import { SampleStateService } from './services/sample-state.service';

@Module({
  imports: [
    DatabaseModule,
    EventCoreModule,
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
    GuestOpsModule,
    StaffingOpsModule,
    SupplierOpsModule,
    AiGovernanceModule,
    LiveOpsModule,
    ClosureOpsModule,
    EventReadModelsModule,
  ],
  controllers: [SampleController],
  providers: [SampleStateService, SampleCompatibilityService],
})
export class SampleCompatibilityModule {}