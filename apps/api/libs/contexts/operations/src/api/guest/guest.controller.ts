import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { zodBody } from '@prism/shared';
import {
  createGuestCheckInSchema,
  createGuestFeedbackSchema,
  type CreateGuestCheckInInput,
  type CreateGuestFeedbackInput,
} from '@prism/types';
import { GuestWorkflowService } from '../../application/guest/guest-workflow.service';

@Controller('guest')
export class OpsGuestController {
  constructor(private readonly guestWorkflowService: GuestWorkflowService) {}

  @Get('events/:accessCode')
  async eventByAccessCode(@Param('accessCode') accessCode: string) {
    const event = await this.guestWorkflowService.getEventByAccessCode(accessCode);
    const attendanceCount = await this.guestWorkflowService.countCheckInsForEvent(event.id);
    return this.guestWorkflowService.mapGuestEvent(event, attendanceCount);
  }

  @Post('events/:accessCode/check-ins')
  @HttpCode(HttpStatus.CREATED)
  async checkIn(
    @Param('accessCode') accessCode: string,
    @Body(zodBody(createGuestCheckInSchema)) dto: CreateGuestCheckInInput,
  ) {
    const checkIn = await this.guestWorkflowService.checkInByAccessCode(accessCode, dto);
    return this.guestWorkflowService.mapGuestCheckIn(checkIn);
  }

  @Post('events/:accessCode/feedback')
  @HttpCode(HttpStatus.CREATED)
  async submitFeedback(
    @Param('accessCode') accessCode: string,
    @Body(zodBody(createGuestFeedbackSchema)) dto: CreateGuestFeedbackInput,
  ) {
    const feedback = await this.guestWorkflowService.submitFeedbackByAccessCode(accessCode, dto);
    return this.guestWorkflowService.mapGuestFeedback(feedback);
  }
}
