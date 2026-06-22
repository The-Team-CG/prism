import { Body, Controller, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import {
  ChangeSupplierTierDto,
  CreateSupplierCertificationDto,
  CreateSupplierDto,
  CreateSupplierReviewDto,
  SupplierActorDto,
  UpdateSupplierDto,
} from '@prism/modules/supplier-ops';
import { EventOpsService } from '../event-ops.service';

@Controller('suppliers')
export class OpsSuppliersController {
  constructor(private readonly eventOpsService: EventOpsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateSupplierDto, @Query() actor: SupplierActorDto) {
    return this.eventOpsService.createSupplier(dto, actor);
  }

  @Patch(':supplierId')
  update(@Param('supplierId') supplierId: string, @Body() dto: UpdateSupplierDto, @Query() actor: SupplierActorDto) {
    return this.eventOpsService.updateSupplier(supplierId, dto, actor);
  }

  @Patch(':supplierId/tier')
  changeTier(
    @Param('supplierId') supplierId: string,
    @Body() dto: ChangeSupplierTierDto,
    @Query() actor: SupplierActorDto,
  ) {
    return this.eventOpsService.changeSupplierTier(supplierId, dto, actor);
  }

  @Post(':supplierId/reviews')
  @HttpCode(HttpStatus.CREATED)
  addReview(
    @Param('supplierId') supplierId: string,
    @Body() dto: CreateSupplierReviewDto,
    @Query() actor: SupplierActorDto,
  ) {
    return this.eventOpsService.addSupplierReview(supplierId, dto, actor);
  }

  @Post(':supplierId/certifications')
  @HttpCode(HttpStatus.CREATED)
  addCertification(
    @Param('supplierId') supplierId: string,
    @Body() dto: CreateSupplierCertificationDto,
    @Query() actor: SupplierActorDto,
  ) {
    return this.eventOpsService.addSupplierCertification(supplierId, dto, actor);
  }
}