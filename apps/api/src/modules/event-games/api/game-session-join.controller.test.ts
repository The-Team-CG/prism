import type { PrismJoinActiveMultiplayerGameSessionInput } from '@prism/types';
import { describe, expect, it, vi } from 'vitest';
import { EventGamesSessionJoinService } from '../application/game-session-join.service';
import { GameSessionJoinController } from './game-session-join.controller';

const input: PrismJoinActiveMultiplayerGameSessionInput = {
  idempotencyKey: '00000000-0000-4000-8000-000000000101',
  pin: '042681',
};

describe('GameSessionJoinController', () => {
  it('validates join input and passes only the retained credential and trusted request IP', async () => {
    const joinActiveMultiplayerSession = vi.fn().mockResolvedValue({
      eventId: 'event-1',
      sessionId: 'session-1',
      game: { title: 'Live Trivia', kind: 'live-trivia' },
      status: 'lobby',
      participantCredential: 'credential-token',
    });
    const controller = new GameSessionJoinController({ joinActiveMultiplayerSession } as unknown as EventGamesSessionJoinService);
    const request = { ip: '203.0.113.10', headers: { 'x-forwarded-for': '198.51.100.9' } };

    await expect(controller.join(input, 'retained-credential', request as never)).resolves.toEqual({
      eventId: 'event-1',
      sessionId: 'session-1',
      game: { title: 'Live Trivia', kind: 'live-trivia' },
      status: 'lobby',
      participantCredential: 'credential-token',
    });
    expect(joinActiveMultiplayerSession).toHaveBeenCalledWith(
      input,
      'retained-credential',
      '203.0.113.10',
    );
  });

  it('uses unknown when the HTTP adapter provides no client IP', async () => {
    const joinActiveMultiplayerSession = vi.fn();
    const controller = new GameSessionJoinController({ joinActiveMultiplayerSession } as unknown as EventGamesSessionJoinService);

    await controller.join(input, undefined, {} as never);

    expect(joinActiveMultiplayerSession).toHaveBeenCalledWith(input, undefined, 'unknown');
  });
});
