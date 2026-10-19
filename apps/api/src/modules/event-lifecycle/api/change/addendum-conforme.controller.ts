import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody } from '@prism/kernel/shared';
import {
  issueAddendumConformeSchema,
  signAddendumConformeSchema,
  type IssueAddendumConformeInput,
  type PrismVerifiedEventActor,
  type SignAddendumConformeInput,
} from '@prism/types';
import { AddendumConformeService } from '../../application/change/addendum-conforme.service';

@Controller('events')
@UseGuards(EventSessionGuard)
export class AddendumConformeController {
  constructor(private readonly service: AddendumConformeService, private readonly access: EventAccessPolicyService) {}

  @Get(':eventId/addenda/conformes')
  listForPmcm(@Param('eventId') eventId: string, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.listForPmcm(eventId, this.access.resolveActor({}, verified));
  }

  @Get(':eventId/addenda/client-conformes')
  listForClient(@Param('eventId') eventId: string, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.listForClient(eventId, this.access.resolveActor({}, verified));
  }

  @Post(':eventId/addenda/:addendumId/conforme')
  @HttpCode(HttpStatus.CREATED)
  issueVersion(
    @Param('eventId') eventId: string,
    @Param('addendumId') addendumId: string,
    @Body(zodBody(issueAddendumConformeSchema)) input: IssueAddendumConformeInput,
    @VerifiedEventActor() verified: PrismVerifiedEventActor,
  ) {
    return this.service.issueVersion(eventId, addendumId, input, this.access.resolveActor({}, verified));
  }

  @Post(':eventId/addenda/:addendumId/conforme/:executionId/acknowledge')
  @HttpCode(HttpStatus.OK)
  acknowledge(
    @Param('eventId') eventId: string,
    @Param('addendumId') addendumId: string,
    @Param('executionId') executionId: string,
    @Body(zodBody(signAddendumConformeSchema)) input: SignAddendumConformeInput,
    @Req() request: Request,
    @VerifiedEventActor() verified: PrismVerifiedEventActor,
  ) {
    if (executionId !== input.executionId) throw new BadRequestException('Addendum conforme id does not match route');
    return this.service.acknowledge(eventId, addendumId, input, this.access.resolveActor({}, verified), requestMetadata(request));
  }

  @Post(':eventId/addenda/:addendumId/conforme/:executionId/countersign')
  @HttpCode(HttpStatus.OK)
  countersign(
    @Param('eventId') eventId: string,
    @Param('addendumId') addendumId: string,
    @Param('executionId') executionId: string,
    @Body(zodBody(signAddendumConformeSchema)) input: SignAddendumConformeInput,
    @Req() request: Request,
    @VerifiedEventActor() verified: PrismVerifiedEventActor,
  ) {
    if (executionId !== input.executionId) throw new BadRequestException('Addendum conforme id does not match route');
    return this.service.countersign(eventId, addendumId, input, this.access.resolveActor({}, verified), requestMetadata(request));
  }
}

function requestMetadata(request: Request) {
  return { ip: request.ip, userAgent: request.get('user-agent') ?? undefined };
}
