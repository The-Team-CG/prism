import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DEV_RESET_KEY_ENV,
  DEV_RESET_KEY_HEADER,
  SAMPLE_DISPOSABLE_DATABASE,
  SampleResetGuard,
} from './sample-reset.guard';

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

function createGuard() {
  return new SampleResetGuard();
}

describe('SampleResetGuard', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalKey = process.env[DEV_RESET_KEY_ENV];
  const databaseEnvNames = ['SUPABASE_DB_URL', 'DATABASE_URL', 'PRISMA_DATABASE_URL', 'DIRECT_URL'] as const;
  const originalDatabaseUrls = Object.fromEntries(databaseEnvNames.map((name) => [name, process.env[name]]));

  beforeEach(() => {
    process.env.NODE_ENV = 'development';
    process.env[DEV_RESET_KEY_ENV] = DEV_KEY;
    process.env.SUPABASE_DB_URL = `postgresql://user:password@127.0.0.1:5432/${SAMPLE_DISPOSABLE_DATABASE}`;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalKey === undefined) delete process.env[DEV_RESET_KEY_ENV];
    else process.env[DEV_RESET_KEY_ENV] = originalKey;
    for (const name of databaseEnvNames) {
      const value = originalDatabaseUrls[name];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  it('requires the local reset key even when a normal PMCM session actor is present', () => {
    const guard = createGuard();
    const { context, request } = createContext();
    request.prismActor = { actorRole: 'pmcm-admin', actorId: 'user_pmcm' };

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('rejects a keyed reset when the effective database is not the disposable local database', () => {
    process.env.SUPABASE_DB_URL = 'postgresql://user:password@database.example.com:5432/prism_sample_disposable';
    process.env.DATABASE_URL = `postgresql://user:password@127.0.0.1:5432/${SAMPLE_DISPOSABLE_DATABASE}`;
    const guard = createGuard();
    const { context } = createContext({ [DEV_RESET_KEY_HEADER]: DEV_KEY });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('rejects a keyed reset when the local database name is not the disposable target', () => {
    process.env.SUPABASE_DB_URL = 'postgresql://user:password@localhost:5432/postgres';
    const guard = createGuard();
    const { context } = createContext({ [DEV_RESET_KEY_HEADER]: DEV_KEY });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('rejects a non-PostgreSQL URL even when its host and path look local', () => {
    process.env.SUPABASE_DB_URL = `http://localhost/${SAMPLE_DISPOSABLE_DATABASE}`;
    const guard = createGuard();
    const { context } = createContext({ [DEV_RESET_KEY_HEADER]: DEV_KEY });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('allows a matching key and injects a System actor', () => {
    const guard = createGuard();
    const { context, request } = createContext({ [DEV_RESET_KEY_HEADER]: DEV_KEY });

    expect(guard.canActivate(context)).toBe(true);
    expect(request.prismActor).toMatchObject({ actorRole: 'system', actorId: 'system_dev_reset' });
  });

  it('rejects a wrong key', () => {
    const guard = createGuard();
    const { context } = createContext({ [DEV_RESET_KEY_HEADER]: 'wrong-key' });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('rejects a key of a different length without throwing from timingSafeEqual', () => {
    const guard = createGuard();
    const { context } = createContext({ [DEV_RESET_KEY_HEADER]: 'short' });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('refuses reset when NODE_ENV is production, even with the correct key', () => {
    process.env.NODE_ENV = 'production';
    const guard = createGuard();
    const { context } = createContext({ [DEV_RESET_KEY_HEADER]: DEV_KEY });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('refuses reset when the key env var is unset', () => {
    delete process.env[DEV_RESET_KEY_ENV];
    const guard = createGuard();
    const { context } = createContext({ [DEV_RESET_KEY_HEADER]: DEV_KEY });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('refuses reset when the key env var is blank', () => {
    process.env[DEV_RESET_KEY_ENV] = '   ';
    const guard = createGuard();
    const { context } = createContext({ [DEV_RESET_KEY_HEADER]: '   ' });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
