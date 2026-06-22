import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/database';
import { AccessControlModule } from '@prism/modules/access-control';
import { EventCoreModule } from '@prism/modules/event-core';
import { NotificationOpsModule } from '@prism/modules/notification-ops';
import { TrustOpsModule } from '@prism/modules/trust-ops';
import { OpsEventBillingController } from './controllers/event-billing.controller';
import { FINANCE_COMMANDS, PAYMENT_STATUS_READER } from './ports/finance-ops.tokens';
import { BillingOperationsService } from './services/billing-operations.service';

@Module({
  imports: [DatabaseModule, EventCoreModule, TrustOpsModule, NotificationOpsModule, AccessControlModule],
  controllers: [OpsEventBillingController],
  providers: [
    BillingOperationsService,
    { provide: FINANCE_COMMANDS, useExisting: BillingOperationsService },
    { provide: PAYMENT_STATUS_READER, useExisting: BillingOperationsService },
  ],
  exports: [BillingOperationsService, FINANCE_COMMANDS, PAYMENT_STATUS_READER],
})
export class FinanceOpsModule {}
