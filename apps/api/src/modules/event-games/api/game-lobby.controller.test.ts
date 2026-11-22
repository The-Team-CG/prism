import type { Request } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { EventGamesLobbyController } from './game-lobby.controller';

describe('EventGamesLobbyController trusted request source', () => {
  it('keys the request source on request.ip, the trust-proxy-aware client address, not the proxy socket', async () => {
    const lobbies = {
      getPublicLobby: vi.fn(),
      startIndependentGame: vi.fn(),
    };
    const controller = new EventGamesLobbyController(lobbies as never);
    // Behind a load balancer the socket is the proxy; Express resolves request.ip to the guest once trust proxy is set.
    const request = {
      ip: '203.0.113.10',
      socket: { remoteAddress: '10.0.0.5' },
      headers: { 'x-forwarded-for': '198.51.100.77' },
    } as unknown as Request;

    await controller.getPublicLobby('opaque-slug', request);
    await controller.startIndependentGame('opaque-slug', 'game-1', {
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
