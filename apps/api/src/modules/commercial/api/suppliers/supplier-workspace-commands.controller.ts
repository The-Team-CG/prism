import { Body, Controller, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import type { PrismVerifiedEventActor } from '@prism/types';
import { SupplierActorDto, SupplierContractUploadDto, SupplierReadinessDto } from './supplier.dto';
import { mapSupplierQuoteRequest } from '../../application/suppliers/supplier-quote-request.mapper';
import { SupplierNetworkWorkflowService } from '../../application/suppliers/supplier-network-workflow.service';

@Controller('supplier')
export class OpsSupplierWorkspaceCommandsController {
  constructor(
    private readonly supplierNetworkWorkflowService: SupplierNetworkWorkflowService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  @Patch('quote-requests/:requestId/assignment/confirm')
  @UseGuards(EventSessionGuard)
  async confirmAssignment(
    @Param('requestId') requestId: string,
    @Query() _actorInput: SupplierActorDto,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return mapSupplierQuoteRequest(await this.supplierNetworkWorkflowService.confirmSupplierAssignment(requestId, actor));
  }

  @Patch('quote-requests/:requestId/readiness/confirm')
  @UseGuards(EventSessionGuard)
  async confirmReadiness(
    @Param('requestId') requestId: string,
    @Body() dto: SupplierReadinessDto,
    @Query() _actorInput: SupplierActorDto,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return mapSupplierQuoteRequest(await this.supplierNetworkWorkflowService.confirmSupplierReadiness(requestId, dto, actor));
  }

  @Post('quote-requests/:requestId/contract')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(EventSessionGuard)
  async uploadContract(
    @Param('requestId') requestId: string,
    @Body() dto: SupplierContractUploadDto,
    @Query() _actorInput: SupplierActorDto,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return mapSupplierQuoteRequest(await this.supplierNetworkWorkflowService.uploadSupplierContract(requestId, dto, actor));
  }
}
