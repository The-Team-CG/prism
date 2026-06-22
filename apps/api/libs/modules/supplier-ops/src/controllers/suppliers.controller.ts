import { Body, Controller, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/modules/access-control';
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
  addReview(
    @Param('supplierId') supplierId: string,
    @Body() dto: CreateSupplierReviewDto,
    @Query() actorInput: SupplierActorDto,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor(actorInput);
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
