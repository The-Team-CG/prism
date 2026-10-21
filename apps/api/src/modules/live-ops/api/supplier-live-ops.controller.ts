import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import { zodBody } from '@prism/kernel/shared';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import {
  updateSupplierEventStatusSchema,
  type UpdateSupplierEventStatusInput,
  type PrismVerifiedEventActor,
} from '@prism/types';
import { EventLiveOpsCommandService } from '../application/event-live-ops-command.service';

@Controller('supplier')
export class SupplierLiveOpsController {
  constructor(
    private readonly commandService: EventLiveOpsCommandService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  @Patch('quote-requests/:requestId/event-status')
  @UseGuards(EventSessionGuard)
  updateEventStatus(
    @Param('requestId') requestId: string,
    @Body(zodBody(updateSupplierEventStatusSchema)) dto: UpdateSupplierEventStatusInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.commandService.updateSupplierEventStatus(requestId, dto, actor);
  }
}
