import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Put } from '@nestjs/common';
import { PublicRateLimit, zodBody } from '@prism/kernel/shared';
import { editPublicInquirySchema, inquiryAccessTokenSchema, saveInquiryDraftSchema, type EditPublicInquiryInput, type SaveInquiryDraftInput } from '@prism/types';
import { InquiryDraftService } from '../../application/onboarding/inquiry-draft.service';
import { InquiriesService } from '../../application/onboarding/inquiries.service';

/** FR-50 public routes: the token in the path is the only credential, so every route is rate limited. */
@Controller('public-inquiries')
export class PublicInquiryDraftController {
  constructor(private readonly drafts: InquiryDraftService, private readonly inquiries: InquiriesService) {}

  @Put('drafts/:token')
  @PublicRateLimit('inquiryDraft')
  save(@Param('token', zodBody(inquiryAccessTokenSchema)) token: string, @Body(zodBody(saveInquiryDraftSchema)) input: SaveInquiryDraftInput) {
    return this.drafts.save(token, input);
  }

  @Get('drafts/:token')
  @PublicRateLimit('inquiryDraft')
  get(@Param('token', zodBody(inquiryAccessTokenSchema)) token: string) {
    return this.drafts.get(token);
  }

  @Delete('drafts/:token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @PublicRateLimit('inquiryDraft')
  async discard(@Param('token', zodBody(inquiryAccessTokenSchema)) token: string) {
    await this.drafts.discard(token);
  }

  @Get('edit/:token')
  @PublicRateLimit('inquiryDraft')
  getEdit(@Param('token', zodBody(inquiryAccessTokenSchema)) token: string) {
    return this.inquiries.getPublicEdit(token);
  }

  @Patch('edit/:token')
  @PublicRateLimit('inquiryDraft')
  edit(@Param('token', zodBody(inquiryAccessTokenSchema)) token: string, @Body(zodBody(editPublicInquirySchema)) input: EditPublicInquiryInput) {
    return this.inquiries.updatePublicEdit(token, input);
  }
}
