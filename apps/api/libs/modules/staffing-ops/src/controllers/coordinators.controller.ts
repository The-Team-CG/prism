import { Controller, Get, Query } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/modules/access-control';
import { OpsUserRole } from '@prism/modules/event-core';
import { SampleActorDto } from '../dto/staffing-ops.dto';
import { CoordinatorsService } from '../services/coordinators.service';

@Controller('coordinators')
export class OpsCoordinatorsController {
  constructor(
    private readonly coordinatorsService: CoordinatorsService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  @Get()
  async list(@Query() actorInput: SampleActorDto) {
    const actor = this.eventAccessPolicyService.resolveActor(actorInput);
    await this.eventAccessPolicyService.requireActorRole(
      actor,
      [OpsUserRole.PmcmAdmin, OpsUserRole.System, OpsUserRole.Coordinator],
      'coordinator directory',
    );
    return this.coordinatorsService.listCoordinators();
  }
}
