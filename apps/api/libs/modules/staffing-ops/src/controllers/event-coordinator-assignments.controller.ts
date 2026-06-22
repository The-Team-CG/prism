import { Body, Controller, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { CreateCoordinatorAssignmentDto } from '../dto/staffing-ops.dto';
import { CoordinatorsService } from '../services/coordinators.service';

@Controller('events')
export class OpsEventCoordinatorAssignmentsController {
  constructor(private readonly coordinatorsService: CoordinatorsService) {}

  @Post(':eventId/coordinators')
  @HttpCode(HttpStatus.CREATED)
  assignCoordinator(
    @Param('eventId') eventId: string,
    @Body() dto: CreateCoordinatorAssignmentDto,
  ) {
    return this.coordinatorsService.assignCoordinator(eventId, dto);
  }

  @Patch(':eventId/coordinators/:assignmentId/acknowledge')
  acknowledgeCoordinator(
    @Param('eventId') eventId: string,
    @Param('assignmentId') assignmentId: string,
  ) {
    return this.coordinatorsService.acknowledgeCoordinator(eventId, assignmentId);
  }
}