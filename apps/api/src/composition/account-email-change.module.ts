import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/kernel/database';
import { CommercialModule } from '../modules/commercial/commercial.module';
import { EventLifecycleModule } from '../modules/event-lifecycle/event-lifecycle.module';
import { IdentityAccessModule } from '../modules/identity-access/identity-access.module';
import { OperationsModule } from '../modules/operations/operations.module';
import { PlatformOpsModule } from '../modules/platform-ops/platform-ops.module';
import { AccountEmailChangeController } from './account-email-change.controller';
import { AccountEmailChangeService } from './account-email-change.service';

/**
 * Account email change sits at the application edge: it needs identity-access and every context that keeps a copy
 * of the address, and commercial already imports identity-access, so identity-access cannot import them back.
 */
@Module({
  imports: [DatabaseModule, IdentityAccessModule, EventLifecycleModule, CommercialModule, OperationsModule, PlatformOpsModule],
  controllers: [AccountEmailChangeController],
  providers: [AccountEmailChangeService],
})
export class AccountEmailChangeModule {}
