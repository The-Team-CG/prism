import { Controller, Get, Header, Inject, Param, Query, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodQuery } from '@prism/kernel/shared';
import {
  pmcmSupplierDirectoryQuerySchema,
  pmcmSupplierHistoryQuerySchema,
  pmcmSupplierProfileQuerySchema,
  pmcmSupplierRecordsQuerySchema,
  type PmcmSupplierDirectoryQuery,
  type PmcmSupplierHistoryQuery,
  type PmcmSupplierProfileQuery,
  type PmcmSupplierRecordsQuery,
  type PrismVerifiedEventActor,
} from '@prism/types';
import type { SupplierWorkspaceReader } from '../../contracts/supplier-workspace-reader.port';
import { SUPPLIER_WORKSPACE_READER } from '../../contracts/supplier-ops.tokens';

@Controller('suppliers')
export class OpsPmcmSupplierDirectoryController {
  constructor(
    @Inject(SUPPLIER_WORKSPACE_READER) private readonly reader: SupplierWorkspaceReader,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  @Get('directory')
  @Header('Cache-Control', 'private, no-store')
  @UseGuards(EventSessionGuard)
  async listDirectory(
    @Query(zodQuery(pmcmSupplierDirectoryQuerySchema)) query: PmcmSupplierDirectoryQuery,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    await this.requirePmcmActor(verifiedActor);
    return this.reader.listDirectory(query);
  }

  @Get(':supplierId/profile')
  @Header('Cache-Control', 'private, no-store')
  @UseGuards(EventSessionGuard)
  async getProfile(
    @Param('supplierId') supplierId: string,
    @Query(zodQuery(pmcmSupplierProfileQuerySchema)) query: PmcmSupplierProfileQuery,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    await this.requirePmcmActor(verifiedActor);
    return this.reader.getProfile(supplierId, query);
  }

  @Get(':supplierId/reviews')
  @Header('Cache-Control', 'private, no-store')
  @UseGuards(EventSessionGuard)
  async listReviews(
    @Param('supplierId') supplierId: string,
    @Query(zodQuery(pmcmSupplierHistoryQuerySchema)) query: PmcmSupplierHistoryQuery,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    await this.requirePmcmActor(verifiedActor);
    return this.reader.listReviews(supplierId, query);
  }

  @Get(':supplierId/certifications')
  @Header('Cache-Control', 'private, no-store')
  @UseGuards(EventSessionGuard)
  async listCertifications(
    @Param('supplierId') supplierId: string,
    @Query(zodQuery(pmcmSupplierHistoryQuerySchema)) query: PmcmSupplierHistoryQuery,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    await this.requirePmcmActor(verifiedActor);
    return this.reader.listCertifications(supplierId, query);
  }

  @Get(':supplierId/records')
  @Header('Cache-Control', 'private, no-store')
  @UseGuards(EventSessionGuard)
  async listRecords(
    @Param('supplierId') supplierId: string,
    @Query(zodQuery(pmcmSupplierRecordsQuerySchema)) query: PmcmSupplierRecordsQuery,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    await this.requirePmcmActor(verifiedActor);
    return this.reader.listRecords(supplierId, query);
  }

  private async requirePmcmActor(verifiedActor: PrismVerifiedEventActor) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    await this.eventAccessPolicyService.requireActorRole(actor, ['pmcm-admin', 'system'], 'PMCM supplier workspace');
  }
}
