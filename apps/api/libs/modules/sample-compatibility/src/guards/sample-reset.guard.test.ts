import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEV_RESET_KEY_ENV, DEV_RESET_KEY_HEADER, SampleResetGuard } from './sample-reset.guard';

const DEV_KEY = 'local-dev-reset-key';

function createContext(headers: Record<string, string> = {}) {
  const request: Record<string, unknown> & { headers: Record<string, string> } = { headers };
  return {
    context: {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext,
    request,
  };
}

function createGuard(sessionBehaviour: 'allow' | 'reject' = 'reject') {
  const canActivate = vi.fn((context: ExecutionContext) => {
    if (sessionBehaviour === 'reject') throw new UnauthorizedException('Missing session token');
    const request = context.switchToHttp().getRequest<Record<string, unknown>>();
    request.prismActor = { actorRole: 'pmcm-admin', actorId: 'user_pmcm' };
    return true;
  });
  const eventSessionGuard = { canActivate } as never;
  return { guard: new SampleResetGuard(eventSessionGuard), canActivate };
}

describe('SampleResetGuard', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalKey = process.env[DEV_RESET_KEY_ENV];

  beforeEach(() => {
    process.env.NODE_ENV = 'development';
    process.env[DEV_RESET_KEY_ENV] = DEV_KEY;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalKey === undefined) delete process.env[DEV_RESET_KEY_ENV];
    else process.env[DEV_RESET_KEY_ENV] = originalKey;
  });

  it('delegates to EventSessionGuard when no dev key header is present', () => {
    const { guard, canActivate } = createGuard('allow');
    const { context, request } = createContext();

    expect(guard.canActivate(context)).toBe(true);
    expect(canActivate).toHaveBeenCalledOnce();
    expect((request.prismActor as { actorRole: string }).actorRole).toBe('pmcm-admin');
  });

  it('still rejects unauthenticated requests that send no dev key', () => {
    const { guard } = createGuard('reject');
    const { context } = createContext();

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('allows the bypass with a matching key and injects a System actor', () => {
    const { guard, canActivate } = createGuard('reject');
    const { context, request } = createContext({ [DEV_RESET_KEY_HEADER]: DEV_KEY });

    expect(guard.canActivate(context)).toBe(true);
    expect(canActivate).not.toHaveBeenCalled();
    expect(request.prismActor).toMatchObject({ actorRole: 'system', actorId: 'system_dev_reset' });
  });

  it('rejects a wrong key by falling through to the session guard', () => {
    const { guard, canActivate } = createGuard('reject');
    const { context } = createContext({ [DEV_RESET_KEY_HEADER]: 'wrong-key' });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    expect(canActivate).toHaveBeenCalledOnce();
  });

  it('rejects a key of a different length without throwing from timingSafeEqual', () => {
    const { guard, canActivate } = createGuard('reject');
    const { context } = createContext({ [DEV_RESET_KEY_HEADER]: 'short' });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    expect(canActivate).toHaveBeenCalledOnce();
  });

  it('refuses the bypass when NODE_ENV is production, even with the correct key', () => {
    process.env.NODE_ENV = 'production';
    const { guard, canActivate } = createGuard('reject');
    const { context } = createContext({ [DEV_RESET_KEY_HEADER]: DEV_KEY });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    expect(canActivate).toHaveBeenCalledOnce();
  });

  it('refuses the bypass when the key env var is unset', () => {
    delete process.env[DEV_RESET_KEY_ENV];
    const { guard, canActivate } = createGuard('reject');
    const { context } = createContext({ [DEV_RESET_KEY_HEADER]: DEV_KEY });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    expect(canActivate).toHaveBeenCalledOnce();
  });

  it('refuses the bypass when the key env var is blank', () => {
    process.env[DEV_RESET_KEY_ENV] = '   ';
    const { guard, canActivate } = createGuard('reject');
    const { context } = createContext({ [DEV_RESET_KEY_HEADER]: '   ' });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    expect(canActivate).toHaveBeenCalledOnce();
  });
});
