import { Controller, Get, Query } from '@nestjs/common';
import { SampleActorDto } from '../dto/event-ops.dto';
import { EventOpsService } from '../event-ops.service';
export { OpsClientController } from '@prism/modules/event-read-models';

@Controller('onboarding')
export class OpsOnboardingController {
  constructor(private readonly eventOpsService: EventOpsService) {}

  @Get()
  list(@Query() actor: SampleActorDto) {
    return this.eventOpsService.listOnboarding(actor);
  }
}

