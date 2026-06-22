import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AccessControlModule } from '@prism/modules/access-control';
import { AiGovernanceModule } from '@prism/modules/ai-governance';
import { ClosureOpsModule } from '@prism/modules/closure-ops';
import { CommercialOpsModule } from '@prism/modules/commercial-ops';
import { ComplianceOpsModule } from '@prism/modules/compliance-ops';
import { EventCoreModule } from '@prism/modules/event-core';
import { EventOpsModule } from '@prism/modules/event-ops';
import { EventReadModelsModule } from '@prism/modules/event-read-models';
import { EventsModule } from '@prism/modules/events';
import { FileOpsModule } from '@prism/modules/file-ops';
import { FinanceOpsModule } from '@prism/modules/finance-ops';
import { FloorplanModule } from '@prism/modules/floorplan';
import { GuestOpsModule } from '@prism/modules/guest-ops';
import { HealthModule } from '@prism/modules/health';
import { IdentityOpsModule } from '@prism/modules/identity-ops';
import { InquiryOnboardingModule } from '@prism/modules/inquiry-onboarding';
import { LiveOpsModule } from '@prism/modules/live-ops';
import { NotificationOpsModule } from '@prism/modules/notification-ops';
import { PlansModule } from '@prism/modules/plans';
import { PublishingModule } from '@prism/modules/publishing';
import { StaffingOpsModule } from '@prism/modules/staffing-ops';
import { SupplierOpsModule } from '@prism/modules/supplier-ops';
import { TemplatesModule } from '@prism/modules/templates';
import { TrustOpsModule } from '@prism/modules/trust-ops';
import { TransformInterceptor } from './common/transform.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    HealthModule,
    TemplatesModule,
    EventsModule,
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
    EventOpsModule,
    PlansModule,
    PublishingModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
  ],
})
export class AppModule {}
