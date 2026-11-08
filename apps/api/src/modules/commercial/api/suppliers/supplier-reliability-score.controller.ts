import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import type { PrismVerifiedEventActor } from '@prism/types';
import { SupplierReliabilityScoreService } from '../../application/suppliers/supplier-reliability-score.service';

@Controller('suppliers/:supplierId/reliability-score')
@UseGuards(EventSessionGuard)
export class SupplierReliabilityScoreController {
  constructor(private readonly service: SupplierReliabilityScoreService, private readonly access: EventAccessPolicyService) {}

  @Get()
  score(@Param('supplierId') supplierId: string, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.score(supplierId, this.access.resolveActor({}, verified));
  }
}
