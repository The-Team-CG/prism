import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody } from '@prism/kernel/shared';
import { downloadOwnPrivacyDataSchema, submitOwnPrivacyRequestSchema, type DownloadOwnPrivacyDataInput, type PrismVerifiedEventActor, type SubmitOwnPrivacyRequestInput } from '@prism/types';
import { AuditService } from '../../application/trust/audit.service';
import { OwnPrivacyRequestService } from '../../application/trust/own-privacy-request.service';
import { SecurityOperationsService } from '../../application/trust/security-operations.service';
import { resolveActor, TrustRoutePolicy } from './audit-privacy.controller';

/** A client or supplier's own privacy requests. The actor comes from the verified session, never from the body. */
@Controller('privacy/requests')
export class OpsOwnPrivacyRequestController {
  private readonly policy: TrustRoutePolicy;

  constructor(
    private readonly ownPrivacyRequestService: OwnPrivacyRequestService,
    auditService: AuditService,
    securityOperationsService: SecurityOperationsService,
  ) {
    this.policy = new TrustRoutePolicy(auditService, securityOperationsService);
  }

  @Get('mine')
  @UseGuards(EventSessionGuard)
  async listMine(@VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = resolveActor(verifiedActor);
    await this.policy.requireSelfServiceRequester(actor, 'own privacy requests');
    return this.ownPrivacyRequestService.listOwn(actor);
  }

  @Post('mine')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.CREATED)
  async submitMine(
    @Body(zodBody(submitOwnPrivacyRequestSchema)) dto: SubmitOwnPrivacyRequestInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = resolveActor(verifiedActor);
    await this.policy.requireSelfServiceRequester(actor, 'own privacy requests');
    return this.ownPrivacyRequestService.submit(dto, actor);
  }

  /** Downloads the requester's own data straight away; the password in the body confirms it is them. */
  @Post('mine/export')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.OK)
  async downloadMine(
    @Body(zodBody(downloadOwnPrivacyDataSchema)) dto: DownloadOwnPrivacyDataInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = resolveActor(verifiedActor);
    await this.policy.requireSelfServiceRequester(actor, 'own privacy requests');
    return this.ownPrivacyRequestService.downloadOwn(dto, actor);
  }

  @Post('mine/:requestId/cancel')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.OK)
  async cancelMine(@Param('requestId') requestId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = resolveActor(verifiedActor);
    await this.policy.requireSelfServiceRequester(actor, 'own privacy requests');
    return this.ownPrivacyRequestService.cancel(requestId, actor);
  }
}
