import { Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { PublishService } from '../../application/authoring/publish.service';

@Controller('publish')
export class PublishController {
  constructor(private readonly publishService: PublishService) {}

  @Post('events/:eventId')
  @HttpCode(HttpStatus.CREATED)
  publishEvent(@Param('eventId') eventId: string) {
    return this.publishService.publishEvent(eventId);
  }

  @Get(':slug')
  getSnapshot(@Param('slug') slug: string) {
    return this.publishService.getPublishedLayout(slug);
  }
}
