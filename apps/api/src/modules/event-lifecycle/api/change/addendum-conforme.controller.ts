import { Body, Controller, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody } from '@prism/kernel/shared';
import { signAddendumConformeExecutionSchema, type PrismVerifiedEventActor, type SignAddendumConformeExecutionInput } from '@prism/types';
import { AddendumConformeService } from '../../application/change/addendum-conforme.service';

@Controller('events/:eventId/addenda/:addendumId/conforme-execution')
@UseGuards(EventSessionGuard)
export class AddendumConformeController {
  constructor(private readonly service: AddendumConformeService, private readonly access: EventAccessPolicyService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  request(@Param('eventId') eventId: string, @Param('addendumId') addendumId: string, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.requestExecution(eventId, addendumId, this.access.resolveActor({}, verified));
  }

  @Post('acknowledge')
  @HttpCode(HttpStatus.OK)
  acknowledge(
    @Param('eventId') eventId: string,
    @Param('addendumId') addendumId: string,
    @Body(zodBody(signAddendumConformeExecutionSchema)) input: SignAddendumConformeExecutionInput,
    @Req() request: Request,
    @VerifiedEventActor() verified: PrismVerifiedEventActor,
  ) {
    return this.service.acknowledgeAsClient(eventId, addendumId, input, this.access.resolveActor({}, verified), this.requestMetadata(request));
  }

  @Post('countersign')
  @HttpCode(HttpStatus.OK)
  countersign(
    @Param('eventId') eventId: string,
    @Param('addendumId') addendumId: string,
    @Body(zodBody(signAddendumConformeExecutionSchema)) input: SignAddendumConformeExecutionInput,
    @Req() request: Request,
    @VerifiedEventActor() verified: PrismVerifiedEventActor,
  ) {
    return this.service.countersignAsPmcm(eventId, addendumId, input, this.access.resolveActor({}, verified), this.requestMetadata(request));
  }

  private requestMetadata(request: Request) {
    return { ip: request.ip, userAgent: request.get('user-agent') ?? undefined };
  }
}
