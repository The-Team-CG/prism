import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Controller('health')
export class HealthController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  check() {
    const requestedProfile = this.config.get<string>('AI_ROUTE_PROFILE')?.trim() || 'mock';
    const isProduction = this.config.get<string>('NODE_ENV') === 'production';
    const profile = requestedProfile === 'test-anthropic' && !isProduction
      ? 'test-anthropic'
      : 'mock';
    const liveUseCases = (this.config.get<string>('AI_LIVE_USE_CASES') || '')
      .split(',')
      .map((useCaseId) => useCaseId.trim())
      .filter(Boolean);
    return {
      status: 'ok',
      service: 'p.r.i.s.m api',
      aiGateway: {
        profile,
        providerCallsEnabled: profile === 'test-anthropic' && liveUseCases.length > 0,
      },
    };
  }
}
