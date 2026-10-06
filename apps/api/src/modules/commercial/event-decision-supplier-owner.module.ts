import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/kernel/database';
import { EVENT_DECISION_SUPPLIER_OWNER } from './contracts/event-decision-supplier-owner.port';
import { EventDecisionSupplierOwnerService } from './application/suppliers/event-decision-supplier-owner.service';

/** Narrow Commercial owner capability for supplier state included in Lifecycle decisions. */
@Module({
  imports: [DatabaseModule],
  providers: [
    EventDecisionSupplierOwnerService,
    { provide: EVENT_DECISION_SUPPLIER_OWNER, useExisting: EventDecisionSupplierOwnerService },
  ],
  exports: [EVENT_DECISION_SUPPLIER_OWNER],
})
export class EventDecisionSupplierOwnerModule {}
