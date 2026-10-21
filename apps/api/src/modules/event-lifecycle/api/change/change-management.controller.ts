import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody } from '@prism/kernel/shared';
import { decideFreezeExceptionSchema, freezeEventSchema, issueAddendumSchema, requestFreezeExceptionSchema, type DecideFreezeExceptionInput, type FreezeEventInput, type IssueAddendumInput, type PrismVerifiedEventActor, type RequestFreezeExceptionInput } from '@prism/types';
import { ChangeManagementService } from '../../application/change/change-management.service';
import { ScopeChangeRequestService } from '../../application/change/scope-change-request.service';

@Controller('events')
export class ChangeManagementController {
  constructor(
    private readonly service: ChangeManagementService,
    private readonly scopeChanges: ScopeChangeRequestService,
    private readonly access: EventAccessPolicyService,
  ) {}

  @Post(':eventId/freeze')
  @UseGuards(EventSessionGuard)
  freeze(@Param('eventId') eventId: string, @Body(zodBody(freezeEventSchema)) input: FreezeEventInput, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.freezeEvent(eventId, input, this.access.resolveActor({}, verified));
  }

  @Post(':eventId/freeze-exceptions')
  @UseGuards(EventSessionGuard)
  requestException(@Param('eventId') eventId: string, @Body(zodBody(requestFreezeExceptionSchema)) input: RequestFreezeExceptionInput, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.requestException(eventId, input, this.access.resolveActor({}, verified));
  }

  // Client-safe projection of freeze-exception rows and scope change requests. Event readers see status and the
  // client response, never internal reasons, impact flags, or PMCM identities.
  @Get(':eventId/change-requests')
  @UseGuards(EventSessionGuard)
  async listClientChangeRequests(@Param('eventId') eventId: string, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    const actor = this.access.resolveActor({}, verified);
    const [exceptions, scopeChanges] = await Promise.all([
      this.service.listClientChangeRequests(eventId, actor),
      this.scopeChanges.listClientRequests(eventId, actor),
    ]);
    return [...scopeChanges, ...exceptions].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  @Get(':eventId/freeze-exceptions')
  @UseGuards(EventSessionGuard)
  listExceptions(@Param('eventId') eventId: string, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.listFreezeExceptions(eventId, this.access.resolveActor({}, verified));
  }

  @Patch(':eventId/freeze-exceptions/:exceptionId')
  @UseGuards(EventSessionGuard)
  decideException(@Param('eventId') eventId: string, @Param('exceptionId') exceptionId: string, @Body(zodBody(decideFreezeExceptionSchema)) input: DecideFreezeExceptionInput, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.decideException(eventId, exceptionId, input, this.access.resolveActor({}, verified));
  }

  @Post(':eventId/addenda')
  @UseGuards(EventSessionGuard)
  issueAddendum(@Param('eventId') eventId: string, @Body(zodBody(issueAddendumSchema)) input: IssueAddendumInput, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.issueAddendum(eventId, input, this.access.resolveActor({}, verified));
  }

  @Get(':eventId/addenda')
  @UseGuards(EventSessionGuard)
  listAddenda(@Param('eventId') eventId: string, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.listAddenda(eventId, this.access.resolveActor({}, verified));
  }
}
