import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, StreamableFile, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody } from '@prism/kernel/shared';
import {
  createConformeExecutionSchema,
  signConformeExecutionSchema,
  type CreateConformeExecutionInput,
  type PrismVerifiedEventActor,
  type SignConformeExecutionInput,
} from '@prism/types';
import { ConformeSigningService } from '../../application/onboarding/conforme-signing.service';

@Controller()
@UseGuards(EventSessionGuard)
export class ConformeSigningController {
  constructor(private readonly conformeSigning: ConformeSigningService) {}

  @Post('inquiries/:inquiryId/conforme-executions')
  @HttpCode(HttpStatus.CREATED)
  createExecution(
    @Param('inquiryId') inquiryId: string,
    @Body(zodBody(createConformeExecutionSchema)) input: CreateConformeExecutionInput,
    @VerifiedEventActor() actor: PrismVerifiedEventActor,
  ) {
    return this.conformeSigning.createExecution(inquiryId, input, actor);
  }

  @Get('inquiries/:inquiryId/conforme-executions/latest')
  latestForPmcm(@Param('inquiryId') inquiryId: string, @VerifiedEventActor() actor: PrismVerifiedEventActor) {
    return this.conformeSigning.latestForPmcm(inquiryId, actor);
  }

  @Get('inquiries/:inquiryId/conforme-executions/latest/pdf')
  async latestPdfForPmcm(@Param('inquiryId') inquiryId: string, @VerifiedEventActor() actor: PrismVerifiedEventActor) {
    const { fileName, pdf } = await this.conformeSigning.pdfForPmcm(inquiryId, actor);
    return new StreamableFile(pdf, { type: 'application/pdf', disposition: `attachment; filename="${fileName}"` });
  }

  @Post('inquiries/:inquiryId/conforme-executions/:executionId/sign')
  @HttpCode(HttpStatus.OK)
  signForPmcm(
    @Param('inquiryId') inquiryId: string,
    @Param('executionId') executionId: string,
    @Body(zodBody(signConformeExecutionSchema)) input: SignConformeExecutionInput,
    @Req() request: Request,
    @VerifiedEventActor() actor: PrismVerifiedEventActor,
  ) {
    if (executionId !== input.executionId) throw new BadRequestException('Conforme execution id does not match route');
    return this.conformeSigning.signForPmcm(inquiryId, input, actor, this.requestMetadata(request));
  }

  @Get('client/conforme-execution')
  currentForClient(@VerifiedEventActor() actor: PrismVerifiedEventActor) {
    return this.conformeSigning.currentForClient(actor);
  }

  @Post('client/conforme-execution/sign')
  @HttpCode(HttpStatus.OK)
  signForClient(
    @Body(zodBody(signConformeExecutionSchema)) input: SignConformeExecutionInput,
    @Req() request: Request,
    @VerifiedEventActor() actor: PrismVerifiedEventActor,
  ) {
    return this.conformeSigning.signForClient(input, actor, this.requestMetadata(request));
  }

  private requestMetadata(request: Request) {
    return {
      ip: request.ip,
      userAgent: request.get('user-agent') ?? undefined,
    };
  }
}
