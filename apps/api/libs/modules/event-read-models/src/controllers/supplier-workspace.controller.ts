import { Controller, Get, Query } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/modules/access-control';
import { mapSupplierQuoteForSupplier } from '@prism/modules/commercial-ops';
import { mapSupplierQuoteRequest } from '@prism/modules/supplier-ops';
import { SampleActorDto } from '../dto/read-model.dto';
import { createSupplierWorkspaceMappers } from '../mappers/event-read-model.mappers';
import { EventReadModelsService } from '../services/event-read-models.service';

@Controller('supplier')
export class OpsSupplierWorkspaceReadsController {
  constructor(
    private readonly eventReadModelsService: EventReadModelsService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  @Get('workspace')
  getSupplierWorkspace(@Query() actorInput: SampleActorDto) {
    const actor = this.eventAccessPolicyService.resolveActor(actorInput);
    return this.eventReadModelsService.supplierWorkspace(
      actor,
      createSupplierWorkspaceMappers({
        mapSupplierQuoteRequest,
        mapSupplierQuoteForSupplier,
      }),
    );
  }

  @Get('readiness-board')
  readinessBoard(@Query() actorInput: SampleActorDto) {
    const actor = this.eventAccessPolicyService.resolveActor(actorInput);
    return this.eventReadModelsService.supplierReadinessBoard(actor);
  }
}
