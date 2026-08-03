import { Controller, Get, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/modules/access-control';
import { mapSupplierQuoteForSupplier } from '@prism/modules/commercial-ops';
import { OpsUserRole } from '@prism/modules/event-core';
import { EventSessionGuard, VerifiedEventActor } from '@prism/modules/identity-ops';
import { mapSupplierQuoteRequest } from '@prism/modules/supplier-ops';
import type { PrismVerifiedEventActor } from '@prism/types';
import { createSupplierWorkspaceMappers } from '../mappers/event-read-model.mappers';
import { EventReadModelsService } from '../services/event-read-models.service';

@Controller('supplier')
export class OpsSupplierWorkspaceReadsController {
  constructor(
    private readonly eventReadModelsService: EventReadModelsService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  /**
   * PA-284: identity comes from the verified session, never from the request.
   *
   * These endpoints previously accepted `?actorRole=supplier&actorEmail=...` and fed
   * it straight to resolveActor, so any unauthenticated caller could name themselves
   * a supplier and read a supplier workspace. The query parameters are gone entirely;
   * resolveActor is now called with an empty input plus the verified actor.
   *
   * PmcmAdmin is allowed alongside Supplier because PMCM staff legitimately inspect
   * supplier readiness from the event command portal.
   */
  @Get('workspace')
  @UseGuards(EventSessionGuard)
  async getSupplierWorkspace(@VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    await this.eventAccessPolicyService.requireActorRole(
      actor,
      [OpsUserRole.Supplier, OpsUserRole.PmcmAdmin],
      'supplier workspace',
    );
    return this.eventReadModelsService.supplierWorkspace(
      actor,
      createSupplierWorkspaceMappers({
        mapSupplierQuoteRequest,
        mapSupplierQuoteForSupplier,
      }),
    );
  }

  @Get('readiness-board')
  @UseGuards(EventSessionGuard)
  async readinessBoard(@VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    await this.eventAccessPolicyService.requireActorRole(
      actor,
      [OpsUserRole.Supplier, OpsUserRole.PmcmAdmin],
      'supplier readiness board',
    );
    return this.eventReadModelsService.supplierReadinessBoard(actor);
  }
}
