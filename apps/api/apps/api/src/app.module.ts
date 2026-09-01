import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AccessControlModule } from '@prism/modules/access-control';
import { PlatformOpsModule } from '@prism/contexts/platform-ops';
import { CommercialModule } from '@prism/contexts/commercial';
import { EventCoreModule } from '@prism/modules/event-core';
import { SampleCompatibilityModule } from '@prism/modules/sample-compatibility';
import { EventReadModelsModule } from '@prism/modules/event-read-models';
import { EventLifecycleModule } from '@prism/contexts/event-lifecycle';
import { FloorplanModule } from '@prism/contexts/floorplan';
import { OperationsModule } from '@prism/contexts/operations';
import { HealthModule } from '@prism/modules/health';
import { IdentityAccessModule } from '@prism/contexts/identity-access';
import { LiveOpsModule } from '@prism/contexts/live-ops';
import { TransformInterceptor } from './common/transform.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    HealthModule,
    EventCoreModule,
    PlatformOpsModule,
    AccessControlModule,
    IdentityAccessModule,
    EventLifecycleModule,
    CommercialModule,
    FloorplanModule,
    OperationsModule,
    LiveOpsModule,
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
