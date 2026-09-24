import { ServiceUnavailableException } from '@nestjs/common';

export type PAREMode = 'mock' | 'live';

export class PareConfigurationError extends ServiceUnavailableException {
  readonly code = 'PARE_CONFIGURATION';
  constructor(message: string) {
    super(message);
    this.name = 'PareConfigurationError';
  }
}

export function configuredPareMode(value: string | undefined): PAREMode {
  if (value === undefined || value === 'mock') return 'mock';
  if (value === 'live') return 'live';
  throw new Error('PARE_MODE must be mock or live');
}

/** Validate the compatibility mode; route and data gates belong to AiGateway. */
export function assertPareExecutionAllowed(mode: string): void {
  if (mode !== 'mock' && mode !== 'live') {
    throw new PareConfigurationError('PARE mode is unsupported. Use mock or live mode.');
  }
}
