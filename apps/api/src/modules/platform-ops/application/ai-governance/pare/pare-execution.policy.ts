import { ServiceUnavailableException } from '@nestjs/common';

export type PAREMode = 'mock' | 'live';

export function configuredPareMode(value: string | undefined): PAREMode {
  if (value === undefined || value === 'mock') return 'mock';
  if (value === 'live') return 'live';
  throw new Error('PARE_MODE must be mock or live');
}

/** Live execution has no approved provider/sanitizer/audit capability yet. */
export function assertPareExecutionAllowed(mode: string): void {
  if (mode !== 'mock') {
    throw new ServiceUnavailableException(
      'Live PARE is disabled until provider retention, sanitization and durable approval controls are verified. Use mock mode.',
    );
  }
}
