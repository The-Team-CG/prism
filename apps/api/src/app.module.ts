import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AccessControlModule } from '@prism/kernel/access-control';
import { DatabaseModule } from '@prism/kernel/database';
import { PlatformOpsAuditWriterModule } from './modules/platform-ops/platform-ops-audit-writer.module';
import { PlatformOpsCommandReceiptModule } from './modules/platform-ops/platform-ops-command-receipt.module';
import { CommercialModule } from './modules/commercial/commercial.module';
import { EventCoreModule } from '@prism/kernel/event-core';
import { ReadModelsModule } from './modules/read-models/read-models.module';
import { EventLifecycleModule } from './modules/event-lifecycle/event-lifecycle.module';
import { FloorplanModule } from './modules/floorplan/floorplan.module';
import { OperationsModule } from './modules/operations/operations.module';
import { HealthModule } from '@prism/kernel/health';
import { IdentityAccessModule } from './modules/identity-access/identity-access.module';
import { LiveOpsModule } from './modules/live-ops/live-ops.module';
import { EventSessionModule } from '@prism/kernel/event-session';
import { OpsEventClosureController } from './modules/event-lifecycle/api/closure/event-closure.controller';
import { EventInsightGenerationController } from './composition/event-insight-generation.controller';
import { EventInsightGenerationService } from './composition/event-insight-generation.service';
import { TransformInterceptor } from './common/transform.interceptor';
import { PlatformReferenceReadersModule } from './composition/platform-reference-readers.module';
import { PlatformPrivacyModule } from './modules/platform-ops/platform-privacy.module';
import { EventGamesModule } from './modules/event-games/event-games.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: process.env.PRISM_ENV_FILE || '.env' }),
    HealthModule,
    PlatformOpsCommandReceiptModule,
    EventCoreModule,
    PlatformOpsAuditWriterModule,
    PlatformReferenceReadersModule,
    PlatformPrivacyModule,
    AccessControlModule,
    IdentityAccessModule,
    EventLifecycleModule,
    EventSessionModule,
    // Closure composes lifecycle, operations, and floorplan; insight generation
    // composes operations staffing facts with the lifecycle writer at the root.
    // Nest instantiates its `@UseGuards(EventSessionGuard)` enhancer in *this*
    // module's context, so the guard's own `PrismaService` dependency has to
    // resolve here too -- importing `EventSessionModule` alone is not enough
    // (cf. PA-280).
    DatabaseModule,
    CommercialModule,
    FloorplanModule,
    OperationsModule,
    LiveOpsModule,
    ReadModelsModule,
    EventGamesModule,
  ],
  controllers: [OpsEventClosureController, EventInsightGenerationController],
  providers: [
    EventInsightGenerationService,
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
  ],
})
export class AppModule {}
