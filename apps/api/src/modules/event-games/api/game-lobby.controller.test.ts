import type { Request } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { EventGamesLobbyController } from './game-lobby.controller';

describe('EventGamesLobbyController trusted request source', () => {
  it('passes only the socket remote address and ignores forwarded-address headers', () => {
    const lobbies = {
      getPublicLobby: vi.fn(),
      startIndependentGame: vi.fn(),
    };
    const controller = new EventGamesLobbyController(lobbies as never);
    const request = {
      socket: { remoteAddress: '203.0.113.10' },
      headers: { 'x-forwarded-for': '198.51.100.77' },
    } as unknown as Request;

    controller.getPublicLobby('opaque-slug', request);
    controller.startIndependentGame('opaque-slug', 'game-1', {
      idempotencyKey: '00000000-0000-4000-8000-000000000004',
    }, request);

    expect(lobbies.getPublicLobby).toHaveBeenCalledWith('opaque-slug', '203.0.113.10');
    expect(lobbies.startIndependentGame).toHaveBeenCalledWith(
      'opaque-slug',
      'game-1',
      { idempotencyKey: '00000000-0000-4000-8000-000000000004' },
      '203.0.113.10',
    );
    expect(JSON.stringify(lobbies)).not.toContain('198.51.100.77');
  });
});
