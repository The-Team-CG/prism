import { Body, Controller, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards, Optional } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody } from '@prism/kernel/shared';
import { createSupplierReliabilityNoteSchema, createSupplierReviewSchema, promoteSupplierSchema, supplierAvailabilitySchema, type CreateSupplierReliabilityNoteInput, type CreateSupplierReviewInput, type PrismVerifiedEventActor, type PromoteSupplierInput, type SupplierAvailabilityInput } from '@prism/types';
import {
  ChangeSupplierTierDto,
  CreateSupplierCertificationDto,
  CreateSupplierDto,
  SupplierActorDto,
  UpdateSupplierDto,
} from './supplier.dto';
import { SupplierProfileCommandsService } from '../../application/suppliers/supplier-profile-commands.service';
import { CommercialWorkflowService } from '../../application/quotes/commercial-workflow.service';

@Controller('suppliers')
export class OpsSuppliersController {
  constructor(
    private readonly eventAccessPolicyService: EventAccessPolicyService,
    private readonly supplierCommands: SupplierProfileCommandsService,
    @Optional() private readonly commercialWorkflow?: CommercialWorkflowService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(EventSessionGuard)
  create(
    @Body() dto: CreateSupplierDto,
    @Query() _actorInput: SupplierActorDto,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.supplierCommands.createSupplier(dto, actor);
  }

  @Post(':supplierId/availability')
  @UseGuards(EventSessionGuard)
  async addAvailability(@Param('supplierId') supplierId: string, @Body(zodBody(supplierAvailabilitySchema)) input: SupplierAvailabilityInput, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    await this.eventAccessPolicyService.requireActorRole(actor, ['pmcm-admin', 'system'], 'supplier availability');
    return this.commercialWorkflow!.setSupplierAvailability(supplierId, input, actor.name);
  }

  @Patch(':supplierId')
  @UseGuards(EventSessionGuard)
  update(
    @Param('supplierId') supplierId: string,
    @Body() dto: UpdateSupplierDto,
    @Query() _actorInput: SupplierActorDto,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.supplierCommands.updateSupplier(supplierId, dto, actor);
  }

  @Patch(':supplierId/tier')
  @UseGuards(EventSessionGuard)
  changeTier(
    @Param('supplierId') supplierId: string,
    @Body() dto: ChangeSupplierTierDto,
    @Query() _actorInput: SupplierActorDto,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.supplierCommands.changeSupplierTier(supplierId, dto, actor);
  }

  @Post(':supplierId/reviews')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(EventSessionGuard)
  addReview(
    @Param('supplierId') supplierId: string,
    @Body(zodBody(createSupplierReviewSchema)) input: CreateSupplierReviewInput,
    @Query() _actorInput: SupplierActorDto,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.supplierCommands.addSupplierReview(supplierId, input, actor);
  }

  @Post(':supplierId/reliability-notes')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(EventSessionGuard)
  addReliabilityNote(
    @Param('supplierId') supplierId: string,
    @Body(zodBody(createSupplierReliabilityNoteSchema)) input: CreateSupplierReliabilityNoteInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.supplierCommands.addReliabilityNote(supplierId, input, actor);
  }

  @Post(':supplierId/promote')
  @HttpCode(HttpStatus.OK)
  @UseGuards(EventSessionGuard)
  promote(
    @Param('supplierId') supplierId: string,
    @Body(zodBody(promoteSupplierSchema)) input: PromoteSupplierInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.supplierCommands.promoteSupplier(supplierId, input, actor);
  }

  @Post(':supplierId/certifications')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(EventSessionGuard)
  addCertification(
    @Param('supplierId') supplierId: string,
    @Body() dto: CreateSupplierCertificationDto,
    @Query() _actorInput: SupplierActorDto,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.supplierCommands.addSupplierCertification(supplierId, dto, actor);
  }
}
