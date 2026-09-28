import { Controller, Get, Inject, Optional } from '@nestjs/common';
import { AI_GATEWAY_HEALTH_STATUS, type AiGatewayHealthStatus } from './ai-gateway-health-status';

@Controller('health')
export class HealthController {
  constructor(
    @Optional() @Inject(AI_GATEWAY_HEALTH_STATUS)
    private readonly aiGatewayStatus?: AiGatewayHealthStatus,
  ) {}

  @Get()
  check() {
    return {
      status: 'ok',
      service: 'p.r.i.s.m api',
      aiGateway: {
        profile: this.aiGatewayStatus?.profile ?? 'mock',
        providerCallsEnabled: this.aiGatewayStatus?.providerCallsEnabled ?? false,
      },
    };
  }
}
