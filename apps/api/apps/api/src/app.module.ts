import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { EventOpsModule } from '@prism/modules/event-ops';
import { EventsModule } from '@prism/modules/events';
import { HealthModule } from '@prism/modules/health';
import { PlansModule } from '@prism/modules/plans';
import { PublishingModule } from '@prism/modules/publishing';
import { TemplatesModule } from '@prism/modules/templates';
import { TransformInterceptor } from './common/transform.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    HealthModule,
    TemplatesModule,
    EventsModule,
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
