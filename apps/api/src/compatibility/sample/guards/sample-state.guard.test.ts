import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ANONYMOUS_SAMPLE_STATE_ENV, SampleStateGuard } from './sample-state.guard';

function createContext() {
  const request: Record<string, unknown> & { headers: Record<string, string> } = { headers: {} };
  return {
    context: { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext,
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
  return { guard: new SampleStateGuard({ canActivate } as never), canActivate };
}

describe('SampleStateGuard', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalFlag = process.env[ANONYMOUS_SAMPLE_STATE_ENV];

  beforeEach(() => {
    process.env.NODE_ENV = 'development';
    delete process.env[ANONYMOUS_SAMPLE_STATE_ENV];
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalFlag === undefined) delete process.env[ANONYMOUS_SAMPLE_STATE_ENV];
    else process.env[ANONYMOUS_SAMPLE_STATE_ENV] = originalFlag;
  });

  it('delegates to the session guard when no opt-in is configured', () => {
    // This is the regression: the route used to be reachable with no session at
    // all on any non-production deployment, including shared staging.
    const { guard, canActivate } = createGuard('reject');
    const { context } = createContext();
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    expect(canActivate).toHaveBeenCalledTimes(1);
  });

  it('admits a verified session', () => {
    const { guard } = createGuard('allow');
    const { context, request } = createContext();
    expect(guard.canActivate(context)).toBe(true);
    expect(request.prismActor).toMatchObject({ actorRole: 'pmcm-admin' });
  });

  it('refuses the anonymous opt-in in production even when the flag is set', () => {
    process.env.NODE_ENV = 'production';
    process.env[ANONYMOUS_SAMPLE_STATE_ENV] = '1';
    const { guard, canActivate } = createGuard('reject');
    const { context } = createContext();
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    expect(canActivate).toHaveBeenCalledTimes(1);
  });

  it('refuses any value other than an exact opt-in', () => {
    const { guard, canActivate } = createGuard('reject');
    for (const value of ['', '0', 'true', 'yes', '11']) {
      process.env[ANONYMOUS_SAMPLE_STATE_ENV] = value;
      const { context } = createContext();
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    }
    expect(canActivate).toHaveBeenCalledTimes(5);
  });

  it('serves an anonymous local read only with the explicit opt-in outside production', () => {
    process.env[ANONYMOUS_SAMPLE_STATE_ENV] = '1';
    const { guard, canActivate } = createGuard('reject');
    const { context, request } = createContext();
    expect(guard.canActivate(context)).toBe(true);
    expect(canActivate).not.toHaveBeenCalled();
    expect(request.prismActor).toMatchObject({ actorRole: 'system', actorId: 'system_local_sample_state' });
  });
});
