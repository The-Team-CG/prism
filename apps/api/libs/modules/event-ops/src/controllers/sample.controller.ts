import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { EventOpsService } from '../event-ops.service';

@Controller('sample')
export class SampleController {
  constructor(private readonly eventOpsService: EventOpsService) {}

  /**
   * Compatibility aggregate for local demos, seed verification, and reset flows.
   * New role surfaces should use scoped controllers such as /client/workspace,
   * /pmcm/dashboard, /supplier/workspace, /events/:id, and /billing.
   */
  @Get('state')
  state() {
    return this.eventOpsService.state();
  }

  @Post('reset')
  @HttpCode(HttpStatus.OK)
  reset() {
    return this.eventOpsService.resetSample();
  }

  @Post('seed')
  @HttpCode(HttpStatus.OK)
  seed() {
    return this.eventOpsService.seedSampleState();
  }
}
