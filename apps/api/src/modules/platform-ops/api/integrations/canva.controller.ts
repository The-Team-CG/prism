import { Controller, Delete, Get, HttpCode, HttpStatus, Inject, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { PRISM_PORTAL_URLS, type PrismPortalUrls } from '@prism/kernel/shared';
import type { PrismVerifiedEventActor } from '@prism/types';
import { CanvaConnectionService } from '../../application/integrations/canva-connection.service';

/** FR-59 and New-P3: PMCM's organization-wide Canva connection. */
@Controller('integrations/canva')
export class CanvaController {
  constructor(
    private readonly canva: CanvaConnectionService,
    private readonly access: EventAccessPolicyService,
    @Inject(PRISM_PORTAL_URLS) private readonly portals: PrismPortalUrls,
  ) {}

  @Get()
  @UseGuards(EventSessionGuard)
  status(@VerifiedEventActor() actor: PrismVerifiedEventActor) {
    return this.canva.status(this.access.resolveActor({}, actor));
  }

  @Post('authorize')
  @HttpCode(HttpStatus.OK)
  @UseGuards(EventSessionGuard)
  authorize(@VerifiedEventActor() actor: PrismVerifiedEventActor) {
    return this.canva.authorizationUrl(this.access.resolveActor({}, actor));
  }

  @Delete()
  @UseGuards(EventSessionGuard)
  disconnect(@VerifiedEventActor() actor: PrismVerifiedEventActor) {
    return this.canva.disconnect(this.access.resolveActor({}, actor));
  }

  /** Canva redirects the browser here; the single-use state ties it to the PMCM request that started it. */
  @Get('callback')
  async callback(@Query('code') code: string | undefined, @Query('state') state: string | undefined, @Res() response: Response) {
    const settings = `${this.portals.event}/dashboard/settings`;
    try {
      await this.canva.completeAuthorization(code, state);
      response.redirect(`${settings}?canva=connected`);
    } catch {
      response.redirect(`${settings}?canva=failed`);
    }
  }
}
