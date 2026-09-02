import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AccessControlModule } from '@prism/kernel/access-control';
import { PlatformOpsAuditWriterModule } from './modules/platform-ops/platform-ops-audit-writer.module';
import { CommercialModule } from './modules/commercial/commercial.module';
import { EventCoreModule } from '@prism/kernel/event-core';
import { SampleCompatibilityModule } from './compatibility/sample/sample-compatibility.module';
import { ReadModelsModule } from './modules/read-models/read-models.module';
import { EventLifecycleModule } from './modules/event-lifecycle/event-lifecycle.module';
import { FloorplanModule } from './modules/floorplan/floorplan.module';
import { OperationsModule } from './modules/operations/operations.module';
import { HealthModule } from '@prism/kernel/health';
import { IdentityAccessModule } from './modules/identity-access/identity-access.module';
import { LiveOpsModule } from './modules/live-ops/live-ops.module';
import { TransformInterceptor } from './common/transform.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    HealthModule,
    EventCoreModule,
    PlatformOpsAuditWriterModule,
    AccessControlModule,
    IdentityAccessModule,
    EventLifecycleModule,
    CommercialModule,
    FloorplanModule,
    OperationsModule,
    LiveOpsModule,
    ReadModelsModule,
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
