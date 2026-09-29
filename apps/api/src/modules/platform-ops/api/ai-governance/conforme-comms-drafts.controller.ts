import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Res, UseGuards } from '@nestjs/common';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody } from '@prism/kernel/shared';
import { commsDraftRequestSchema, commsDraftResultSchema, type CommsDraftRequest, type CommsDraftResult, type PrismVerifiedEventActor } from '@prism/types';
import type { Response } from 'express';
import { ConformeCommsDraftService } from '../../application/ai-governance/conforme-comms-draft.service';

@Controller('comms-drafts')
@UseGuards(EventSessionGuard)
export class ConformeCommsDraftsController {
  constructor(private readonly conformeCommsDraftService: ConformeCommsDraftService) {}

  @Post('stream')
  @HttpCode(HttpStatus.OK)
  async stream(
    @Body(zodBody(commsDraftRequestSchema)) input: CommsDraftRequest,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
    @Res() response: Response,
  ) {
    const abortController = new AbortController();
    const events = await this.conformeCommsDraftService.prepareStream(input, verifiedActor, abortController.signal);
    response.status(HttpStatus.OK);
    response.set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    response.flushHeaders();
    response.on('close', () => {
      if (!response.writableEnded) abortController.abort(new Error('Client disconnected'));
    });

    try {
      for await (const event of events) {
        if (response.destroyed) break;
        response.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch {
      // Gateway failure outcomes are streamed as typed events. Other failures
      // close the stream without exposing provider or database details.
    } finally {
      if (!response.writableEnded) response.end();
    }
  }

  @Get(':inquiryId')
  getForInquiry(
    @Param('inquiryId') inquiryId: string,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    return this.conformeCommsDraftService.loadForInquiry(inquiryId, verifiedActor);
  }

  @Post(':inquiryId/manual')
  @HttpCode(HttpStatus.CREATED)
  saveManual(
    @Param('inquiryId') inquiryId: string,
    @Body(zodBody(commsDraftResultSchema)) draft: CommsDraftResult,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    return this.conformeCommsDraftService.saveManual(inquiryId, draft, verifiedActor);
  }

  @Post(':draftId/approve')
  @HttpCode(HttpStatus.OK)
  approve(
    @Param('draftId') draftId: string,
    @Body(zodBody(commsDraftResultSchema)) draft: CommsDraftResult,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    return this.conformeCommsDraftService.approve(draftId, draft, verifiedActor);
  }

  @Post(':draftId/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @Param('draftId') draftId: string,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    return this.conformeCommsDraftService.cancel(draftId, verifiedActor);
  }
}
