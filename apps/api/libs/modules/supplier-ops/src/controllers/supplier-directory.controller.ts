import { Controller, Get, Query } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/modules/access-control';
import { OpsUserRole } from '@prism/modules/event-core';
import { SupplierActorDto } from '../dto/supplier.dto';
import { SuppliersService } from '../services/suppliers.service';

@Controller('suppliers')
export class OpsSupplierDirectoryController {
  constructor(
    private readonly suppliersService: SuppliersService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  @Get('categories')
  async listCategories(@Query() actorInput: SupplierActorDto) {
    const actor = this.eventAccessPolicyService.resolveActor(actorInput);
    await this.eventAccessPolicyService.requireActorRole(
      actor,
      [OpsUserRole.PmcmAdmin, OpsUserRole.System, OpsUserRole.Supplier],
      'supplier categories',
    );
    return this.suppliersService.listSupplierCategories();
  }

  @Get()
  async list(@Query() actorInput: SupplierActorDto) {
    const actor = this.eventAccessPolicyService.resolveActor(actorInput);
    await this.eventAccessPolicyService.requireActorRole(
      actor,
      [OpsUserRole.PmcmAdmin, OpsUserRole.System],
      'supplier directory',
    );
    return this.suppliersService.listSuppliers();
  }
}