import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AccessControlModule } from '@prism/modules/access-control';
import { AiGovernanceModule } from '@prism/modules/ai-governance';
import { ClosureOpsModule } from '@prism/modules/closure-ops';
import { CommercialOpsModule } from '@prism/modules/commercial-ops';
import { ComplianceOpsModule } from '@prism/modules/compliance-ops';
import { EventCoreModule } from '@prism/modules/event-core';
import { SampleCompatibilityModule } from '@prism/modules/sample-compatibility';
import { EventReadModelsModule } from '@prism/modules/event-read-models';
import { FileOpsModule } from '@prism/modules/file-ops';
import { FinanceOpsModule } from '@prism/modules/finance-ops';
import { FloorplanModule } from '@prism/contexts/floorplan';
import { OperationsModule } from '@prism/contexts/operations';
import { HealthModule } from '@prism/modules/health';
import { IdentityOpsModule } from '@prism/modules/identity-ops';
import { InquiryOnboardingModule } from '@prism/modules/inquiry-onboarding';
import { LiveOpsModule } from '@prism/modules/live-ops';
import { NotificationOpsModule } from '@prism/modules/notification-ops';
import { SupplierOpsModule } from '@prism/modules/supplier-ops';
import { TrustOpsModule } from '@prism/modules/trust-ops';
import { TransformInterceptor } from './common/transform.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    HealthModule,
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
    OperationsModule,
    SupplierOpsModule,
    AiGovernanceModule,
    LiveOpsModule,
    ClosureOpsModule,
    EventReadModelsModule,
    SampleCompatibilityModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
  ],
})
export class AppModule {}
