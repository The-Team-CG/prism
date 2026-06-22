import { Body, Controller, Param, Patch, Query } from '@nestjs/common';
import { SampleActorDto, SupplierEventStatusDto } from '../dto/event-ops.dto';
import { EventOpsService } from '../event-ops.service';

@Controller('supplier')
export class OpsSupplierWorkspaceController {
  constructor(private readonly eventOpsService: EventOpsService) {}


  @Patch('quote-requests/:requestId/event-status')
  updateEventStatus(
    @Param('requestId') requestId: string,
    @Body() dto: SupplierEventStatusDto,
    @Query() actor: SampleActorDto,
  ) {
    return this.eventOpsService.updateSupplierEventStatus(requestId, dto, actor);
  }
}
