import type { PrismSubmitEventGameActionInput } from '@prism/types';
import { describe, expect, it, vi } from 'vitest';
import { GameActionService } from '../application/game-action.service';
import { GameReadModelService } from '../application/game-read-model.service';
import { GameSessionController } from './game-session.controller';

describe('GameSessionController', () => {
  it('forwards the participant credential only to the scoped action and state services', async () => {
    const submitAction = vi.fn().mockResolvedValue({ status: 'live' });
    const getParticipantState = vi.fn().mockResolvedValue({ status: 'live' });
    const getParticipantMediaAuthorization = vi.fn().mockResolvedValue({ downloadUrl: 'https://storage.test/image', expiresAt: '2026-10-16T12:05:00.000Z' });
    const controller = new GameSessionController(
      { submitAction } as unknown as GameActionService,
      { getParticipantState, getParticipantMediaAuthorization } as unknown as GameReadModelService,
    );
    const action: PrismSubmitEventGameActionInput = {
      roundKey: 'round-1',
      actionKind: 'answer',
      payload: { answer: 'B' },
    };

    await expect(controller.getParticipantState('session-1', 'credential-token')).resolves.toEqual({ status: 'live' });
    await expect(controller.getParticipantMediaAuthorization('session-1', 'obj_a78bde2c-61a4-4e5f-b9ba-dbe21ca203b5', 'credential-token'))
      .resolves.toMatchObject({ expiresAt: '2026-10-16T12:05:00.000Z' });
    await expect(controller.submitAction('session-1', 'credential-token', action)).resolves.toEqual({ status: 'live' });

    expect(getParticipantState).toHaveBeenCalledWith('session-1', 'credential-token');
    expect(getParticipantMediaAuthorization).toHaveBeenCalledWith(
      'session-1', 'obj_a78bde2c-61a4-4e5f-b9ba-dbe21ca203b5', 'credential-token',
    );
    expect(submitAction).toHaveBeenCalledWith('session-1', 'credential-token', action);
  });
});
