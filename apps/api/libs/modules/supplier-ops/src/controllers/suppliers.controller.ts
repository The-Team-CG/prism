import { Body, Controller, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/modules/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/modules/event-session';
import type { PrismVerifiedEventActor } from '@prism/types';
import {
  ChangeSupplierTierDto,
  CreateSupplierCertificationDto,
  CreateSupplierDto,
  CreateSupplierReviewDto,
  SupplierActorDto,
  UpdateSupplierDto,
} from '../dto/supplier.dto';
import { SupplierProfileCommandsService } from '../services/supplier-profile-commands.service';

@Controller('suppliers')
export class OpsSuppliersController {
  constructor(
    private readonly eventAccessPolicyService: EventAccessPolicyService,
    private readonly supplierCommands: SupplierProfileCommandsService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateSupplierDto, @Query() actorInput: SupplierActorDto) {
    const actor = this.eventAccessPolicyService.resolveActor(actorInput);
    return this.supplierCommands.createSupplier(dto, actor);
  }

  @Patch(':supplierId')
  update(@Param('supplierId') supplierId: string, @Body() dto: UpdateSupplierDto, @Query() actorInput: SupplierActorDto) {
    const actor = this.eventAccessPolicyService.resolveActor(actorInput);
    return this.supplierCommands.updateSupplier(supplierId, dto, actor);
  }

  @Patch(':supplierId/tier')
  changeTier(
    @Param('supplierId') supplierId: string,
    @Body() dto: ChangeSupplierTierDto,
    @Query() actorInput: SupplierActorDto,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor(actorInput);
    return this.supplierCommands.changeSupplierTier(supplierId, dto, actor);
  }

  @Post(':supplierId/reviews')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(EventSessionGuard)
  addReview(
    @Param('supplierId') supplierId: string,
    @Body() dto: CreateSupplierReviewDto,
    @Query() _actorInput: SupplierActorDto,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.supplierCommands.addSupplierReview(supplierId, dto, actor);
  }

  @Post(':supplierId/certifications')
  @HttpCode(HttpStatus.CREATED)
  addCertification(
    @Param('supplierId') supplierId: string,
    @Body() dto: CreateSupplierCertificationDto,
    @Query() actorInput: SupplierActorDto,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor(actorInput);
    return this.supplierCommands.addSupplierCertification(supplierId, dto, actor);
  }
}
