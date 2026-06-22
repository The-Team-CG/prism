import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { SampleCompatibilityService } from '../services/sample-compatibility.service';

@Controller('sample')
export class SampleController {
  constructor(private readonly sampleCompatibilityService: SampleCompatibilityService) {}

  /**
   * Compatibility aggregate for local demos, seed verification, and reset flows.
   * New role surfaces should use scoped controllers such as /client/workspace,
   * /pmcm/dashboard, /supplier/workspace, /events/:id, and /billing.
   */
  @Get('state')
  state() {
    return this.sampleCompatibilityService.state();
  }

  @Post('reset')
  @HttpCode(HttpStatus.OK)
  reset() {
    return this.sampleCompatibilityService.resetSample();
  }

  @Post('seed')
  @HttpCode(HttpStatus.OK)
  seed() {
    return this.sampleCompatibilityService.seedSampleState();
  }
}
