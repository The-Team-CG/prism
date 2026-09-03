import type { OpsRegistrationPlatform } from '@prisma/client';
import type { PrismRegistrationPlatform } from '@prism/types';

export interface RegistrationPlatformReader {
  getByEventId(eventId: string): Promise<OpsRegistrationPlatform | null>;
  mapRegistrationPlatform(platform: OpsRegistrationPlatform): PrismRegistrationPlatform;
}
