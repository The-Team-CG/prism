import { Body, Controller, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { zodBody } from '@prism/shared';
import { EventAccessPolicyService } from '@prism/modules/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/modules/identity-ops';
import {
  updateSupplierEventStatusSchema,
  type UpdateSupplierEventStatusInput,
  type PrismVerifiedEventActor,
} from '@prism/types';
import { LiveOpsActorDto } from '../dto/live-ops.dto';
import { EventLiveOpsCommandService } from '../services/event-live-ops-command.service';

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
    @Query() _actorInput: LiveOpsActorDto,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.commandService.updateSupplierEventStatus(requestId, dto, actor);
  }
}
