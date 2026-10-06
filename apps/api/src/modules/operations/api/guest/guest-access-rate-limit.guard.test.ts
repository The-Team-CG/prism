import { HttpException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { GuestAccessLimiter } from '../../application/guest/guest-access-limiter';
import { GuestAccessRateLimitGuard } from './guest-access-rate-limit.guard';

function contextFor(request: { ip?: string; method: string; params?: Record<string, string> }) {
  const response = { setHeader: vi.fn() };
  const context = { switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }) };
  return { context: context as never, response };
}

describe('GuestAccessLimiter', () => {
  it('allows traffic under the limit, refuses the excess with a retry delay, and starts a new window after it', () => {
    const limiter = new GuestAccessLimiter();
    const decisions = [0, 0, 0, 0].map(() => limiter.consume('key', 3, 60_000, 1_000));

    expect(decisions.slice(0, 3).every((decision) => decision.allowed)).toBe(true);
    expect(decisions[3]).toEqual({ allowed: false, retryAfterSeconds: 60 });
    expect(limiter.consume('other', 3, 60_000, 1_000)).toEqual({ allowed: true });
    expect(limiter.consume('key', 3, 60_000, 61_001)).toEqual({ allowed: true });
  });

  it('stays bounded when more keys arrive than it tracks', () => {
    const limiter = new GuestAccessLimiter();
    for (let index = 0; index < 6000; index += 1) limiter.consume('k' + index, 1, 60_000, 1_000);

    expect(limiter.consume('k5999', 1, 60_000, 1_001)).toEqual({ allowed: false, retryAfterSeconds: 60 });
    expect(limiter.consume('k0', 1, 60_000, 1_001)).toEqual({ allowed: true });
  });
});

describe('GuestAccessRateLimitGuard', () => {
  it('lets a venue check guests in at a busy pace, then refuses a flood with 429 and Retry-After', () => {
    const guard = new GuestAccessRateLimitGuard();
    const { context, response } = contextFor({ ip: '10.0.0.1', method: 'POST', params: { accessCode: 'ABC123' } });

    for (let attempt = 0; attempt < 120; attempt += 1) expect(guard.canActivate(context)).toBe(true);
    let error: unknown;
    try {
      guard.canActivate(context);
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(429);
    expect(response.setHeader).toHaveBeenCalledWith('Retry-After', expect.stringMatching(/^\d+$/));
  });

  it('limits a client and access code independently of other clients and codes', () => {
    const guard = new GuestAccessRateLimitGuard();
    const flood = contextFor({ ip: '10.0.0.2', method: 'POST', params: { accessCode: 'AAA111' } }).context;
    for (let attempt = 0; attempt < 120; attempt += 1) guard.canActivate(flood);

    expect(() => guard.canActivate(flood)).toThrow(HttpException);
    expect(guard.canActivate(contextFor({ ip: '10.0.0.3', method: 'POST', params: { accessCode: 'AAA111' } }).context)).toBe(true);
    expect(guard.canActivate(contextFor({ ip: '10.0.0.2', method: 'POST', params: { accessCode: 'BBB222' } }).context)).toBe(true);
  });
});
