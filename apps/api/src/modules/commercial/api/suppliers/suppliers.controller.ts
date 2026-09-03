import { Body, Controller, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody } from '@prism/kernel/shared';
import { createSupplierReviewSchema, type CreateSupplierReviewInput, type PrismVerifiedEventActor } from '@prism/types';
import {
  ChangeSupplierTierDto,
  CreateSupplierCertificationDto,
  CreateSupplierDto,
  SupplierActorDto,
  UpdateSupplierDto,
} from './supplier.dto';
import { SupplierProfileCommandsService } from '../../application/suppliers/supplier-profile-commands.service';

@Controller('suppliers')
export class OpsSuppliersController {
  constructor(
    private readonly eventAccessPolicyService: EventAccessPolicyService,
    private readonly supplierCommands: SupplierProfileCommandsService,
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
