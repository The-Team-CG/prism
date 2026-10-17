import { describe, expect, it } from 'vitest';
import { createAnonymousGameParticipantAlias } from './anonymous-game-participant-alias';

describe('createAnonymousGameParticipantAlias', () => {
  it('keeps a participant label stable without exposing the grant identifier', () => {
    const grantId = 'participation-1';
    const alias = createAnonymousGameParticipantAlias(grantId);

    expect(alias).toMatch(/^Guest [A-F0-9]{10}$/);
    expect(createAnonymousGameParticipantAlias(grantId)).toBe(alias);
    expect(alias).not.toContain(grantId);
    expect(createAnonymousGameParticipantAlias('participation-2')).not.toBe(alias);
  });
});
