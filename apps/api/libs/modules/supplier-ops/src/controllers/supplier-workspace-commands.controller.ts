import { Body, Controller, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/modules/access-control';
import { SupplierActorDto, SupplierContractUploadDto, SupplierReadinessDto } from '../dto/supplier.dto';
import { mapSupplierQuoteRequest } from '../mappers/supplier-quote-request.mapper';
import { SupplierNetworkWorkflowService } from '../services/supplier-network-workflow.service';

@Controller('supplier')
export class OpsSupplierWorkspaceCommandsController {
  constructor(
    private readonly supplierNetworkWorkflowService: SupplierNetworkWorkflowService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  @Patch('quote-requests/:requestId/assignment/confirm')
  async confirmAssignment(@Param('requestId') requestId: string, @Query() actorInput: SupplierActorDto) {
    const actor = this.eventAccessPolicyService.resolveActor(actorInput);
    return mapSupplierQuoteRequest(await this.supplierNetworkWorkflowService.confirmSupplierAssignment(requestId, actor));
  }

  @Patch('quote-requests/:requestId/readiness/confirm')
  async confirmReadiness(
    @Param('requestId') requestId: string,
    @Body() dto: SupplierReadinessDto,
    @Query() actorInput: SupplierActorDto,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor(actorInput);
    return mapSupplierQuoteRequest(await this.supplierNetworkWorkflowService.confirmSupplierReadiness(requestId, dto, actor));
  }

  @Post('quote-requests/:requestId/contract')
  @HttpCode(HttpStatus.CREATED)
  async uploadContract(
    @Param('requestId') requestId: string,
    @Body() dto: SupplierContractUploadDto,
    @Query() actorInput: SupplierActorDto,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor(actorInput);
    return mapSupplierQuoteRequest(await this.supplierNetworkWorkflowService.uploadSupplierContract(requestId, dto, actor));
  }
}