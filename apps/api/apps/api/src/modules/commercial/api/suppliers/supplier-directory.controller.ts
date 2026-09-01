import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import type { PrismVerifiedEventActor } from '@prism/types';
import { SupplierActorDto } from './supplier.dto';
import { SuppliersService } from '../../application/suppliers/suppliers.service';

@Controller('suppliers')
export class OpsSupplierDirectoryController {
  constructor(
    private readonly suppliersService: SuppliersService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  @Get('categories')
  @UseGuards(EventSessionGuard)
  async listCategories(
    @Query() _actorInput: SupplierActorDto,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    await this.eventAccessPolicyService.requireActorRole(
      actor,
      [OpsUserRole.PmcmAdmin, OpsUserRole.System, OpsUserRole.Supplier],
      'supplier categories',
    );
    return this.suppliersService.listSupplierCategories();
  }

  @Get()
  @UseGuards(EventSessionGuard)
  async list(
    @Query() _actorInput: SupplierActorDto,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    await this.eventAccessPolicyService.requireActorRole(
      actor,
      [OpsUserRole.PmcmAdmin, OpsUserRole.System],
      'supplier directory',
    );
    return this.suppliersService.listSuppliers();
  }
}
