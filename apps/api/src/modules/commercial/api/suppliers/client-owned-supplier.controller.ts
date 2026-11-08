import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody } from '@prism/kernel/shared';
import {
  createClientOwnedSupplierSchema,
  raiseClientSupplierRiskSchema,
  type CreateClientOwnedSupplierInput,
  type PrismVerifiedEventActor,
  type RaiseClientSupplierRiskInput,
} from '@prism/types';
import { ClientOwnedSupplierService } from '../../application/suppliers/client-owned-supplier.service';
import { UnresponsiveSupplierService } from '../../application/suppliers/unresponsive-supplier.service';

@Controller('events/:eventId')
@UseGuards(EventSessionGuard)
export class ClientOwnedSupplierController {
  constructor(
    private readonly clientOwned: ClientOwnedSupplierService,
    private readonly unresponsive: UnresponsiveSupplierService,
    private readonly access: EventAccessPolicyService,
  ) {}

  @Get('client-owned-suppliers')
  list(@Param('eventId') eventId: string, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.clientOwned.list(eventId, this.access.resolveActor({}, verified));
  }

  @Post('client-owned-suppliers')
  create(@Param('eventId') eventId: string, @Body(zodBody(createClientOwnedSupplierSchema)) input: CreateClientOwnedSupplierInput, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.clientOwned.create(eventId, input, this.access.resolveActor({}, verified));
  }

  @Post('client-owned-suppliers/:supplierId/confirm')
  confirm(@Param('eventId') eventId: string, @Param('supplierId') supplierId: string, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.clientOwned.confirm(eventId, supplierId, this.access.resolveActor({}, verified));
  }

  @Post('client-owned-suppliers/:supplierId/risk-warning')
  raiseRisk(@Param('eventId') eventId: string, @Param('supplierId') supplierId: string, @Body(zodBody(raiseClientSupplierRiskSchema)) input: RaiseClientSupplierRiskInput, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.clientOwned.raiseRisk(eventId, supplierId, input, this.access.resolveActor({}, verified));
  }

  @Get('unresponsive-suppliers')
  unresponsiveSuppliers(@Param('eventId') eventId: string, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.unresponsive.list(eventId, this.access.resolveActor({}, verified));
  }
}
