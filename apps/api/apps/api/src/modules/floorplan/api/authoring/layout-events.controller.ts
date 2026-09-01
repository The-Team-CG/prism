import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CreateEventDto } from './create-event.dto';
import { LayoutEventsService } from '../../application/authoring/layout-events.service';

@Controller('layout-events')
export class LayoutEventsController {
  constructor(private readonly eventsService: LayoutEventsService) {}

  @Get()
  list() {
    return this.eventsService.listEvents();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateEventDto) {
    return this.eventsService.createEventFromTemplate(dto);
  }
}
