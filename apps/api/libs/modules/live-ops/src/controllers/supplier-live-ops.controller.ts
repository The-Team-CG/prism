import { Body, Controller, Param, Patch, Query } from '@nestjs/common';
import { LiveOpsActorDto, SupplierEventStatusDto } from '../dto/live-ops.dto';
import { EventLiveOpsCommandService } from '../services/event-live-ops-command.service';

@Controller('supplier')
export class SupplierLiveOpsController {
  constructor(private readonly commandService: EventLiveOpsCommandService) {}

  @Patch('quote-requests/:requestId/event-status')
  updateEventStatus(
    @Param('requestId') requestId: string,
    @Body() dto: SupplierEventStatusDto,
    @Query() actor: LiveOpsActorDto,
  ) {
    return this.commandService.updateSupplierEventStatus(requestId, dto, actor);
  }
}