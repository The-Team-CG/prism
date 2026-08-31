import { Controller, Get, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/modules/access-control';
import { BillingOperationsService } from '@prism/contexts/commercial';
import { EventSessionGuard, VerifiedEventActor } from '@prism/modules/identity-ops';
import type { PrismVerifiedEventActor } from '@prism/types';
import { createBillingReadModelMappers } from '../mappers/event-read-model.mappers';
import { mapBillingEvent } from '../mappers/billing-read-model.mappers';
import { EventReadModelsService } from '../services/event-read-models.service';

@Controller('billing')
export class OpsBillingController {
  constructor(
    private readonly eventReadModelsService: EventReadModelsService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
    private readonly billingOperationsService: BillingOperationsService,
  ) {}

  @Get()
  @UseGuards(EventSessionGuard)
  list(@VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.eventReadModelsService.billing(
      actor,
      createBillingReadModelMappers({
        mapEvent: mapBillingEvent,
        mapBillingSource: this.billingOperationsService.mapBillingSource.bind(this.billingOperationsService),
        mapBillingStatement: this.billingOperationsService.mapBillingStatement.bind(this.billingOperationsService),
        mapPaymentMilestone: this.billingOperationsService.mapPaymentMilestone.bind(this.billingOperationsService),
        mapPaymentRecord: this.billingOperationsService.mapPaymentRecord.bind(this.billingOperationsService),
      }),
    );
  }
}
