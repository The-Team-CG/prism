import { Controller, Get, Query } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/modules/access-control';
import { SampleActorDto } from '../dto/read-model.dto';
import { EventReadModelsService } from '../services/event-read-models.service';

@Controller('pmcm')
export class OpsPmcmCommandInboxController {
  constructor(
    private readonly eventReadModelsService: EventReadModelsService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  @Get('command-inbox')
  commandInbox(@Query() actorInput: SampleActorDto) {
    const actor = this.eventAccessPolicyService.resolveActor(actorInput);
    return this.eventReadModelsService.pmcmCommandInbox(actor);
  }
}
