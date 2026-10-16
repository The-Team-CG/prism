import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/kernel/database';
import { OperationsEventReferenceModule } from '@prism/contexts/event-lifecycle/operations-reference';
import { GUEST_PASS_DELIVERY_ELIGIBILITY_READER } from './guest-pass-delivery-eligibility.port';
import { GuestPassDeliveryEligibilityService } from './guest-pass-delivery-eligibility.service';

/** Narrow read-only composition for the platform notification worker. */
@Module({
  imports: [DatabaseModule, OperationsEventReferenceModule],
  providers: [
    GuestPassDeliveryEligibilityService,
    { provide: GUEST_PASS_DELIVERY_ELIGIBILITY_READER, useExisting: GuestPassDeliveryEligibilityService },
  ],
  exports: [GUEST_PASS_DELIVERY_ELIGIBILITY_READER],
})
export class GuestPassDeliveryEligibilityModule {}
