import { createHash } from 'node:crypto';

export function createAnonymousGameParticipantAlias(participationGrantId: string): string {
  const suffix = createHash('sha256').update(participationGrantId).digest('hex').slice(0, 10).toUpperCase();
  return `Guest ${suffix}`;
}
