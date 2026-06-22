import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { GuestCheckInDto, GuestFeedbackDto } from '../dto/guest.dto';
import { GuestWorkflowService } from '../services/guest-workflow.service';

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
  async checkIn(@Param('accessCode') accessCode: string, @Body() dto: GuestCheckInDto) {
    const checkIn = await this.guestWorkflowService.checkInByAccessCode(accessCode, dto);
    return this.guestWorkflowService.mapGuestCheckIn(checkIn);
  }

  @Post('events/:accessCode/feedback')
  @HttpCode(HttpStatus.CREATED)
  async submitFeedback(@Param('accessCode') accessCode: string, @Body() dto: GuestFeedbackDto) {
    const feedback = await this.guestWorkflowService.submitFeedbackByAccessCode(accessCode, dto);
    return this.guestWorkflowService.mapGuestFeedback(feedback);
  }
}