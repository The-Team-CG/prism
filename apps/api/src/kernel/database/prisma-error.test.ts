import { describe, expect, it } from 'vitest';
import { describeDatabaseError } from './prisma-error';

/**
 * PA-309. These use SYNTHETIC errors on purpose. Provoking a real Prisma failure
 * would need a live database, which is what the four *.database.test.ts files do
 * — and those are gated on P0_TEST_DATABASE_URL and were skipped in every
 * test:api run, so a test written that way would silently never execute.
 */
function prismaLikeError(): Error & { code: string; meta: Record<string, unknown> } {
  const error = new Error('Invalid `this.prisma.opsUser.count()` invocation') as Error & {
    code: string;
    meta: Record<string, unknown>;
  };
  error.code = 'P2024';
  error.meta = { modelName: 'OpsUser', connection_limit: 10 };
  return error;
}

describe('describeDatabaseError', () => {
  it('keeps the original message', () => {
    expect(describeDatabaseError(prismaLikeError())).toContain(
      'Invalid `this.prisma.opsUser.count()` invocation',
    );
  });

  it('surfaces the Prisma error code, which is the diagnostic that identifies the failure', () => {
    expect(describeDatabaseError(prismaLikeError())).toContain('P2024');
  });

  it('surfaces error.meta', () => {
    const described = describeDatabaseError(prismaLikeError());
    expect(described).toContain('OpsUser');
    expect(described).toContain('connection_limit');
  });

  it('renders a plain Error as the message alone, never the string "undefined"', () => {
    const described = describeDatabaseError(new Error('database unavailable'));
    expect(described).toBe('database unavailable');
    expect(described).not.toContain('undefined');
  });

  it('falls back to String() for a non-Error value, preserving prior behaviour', () => {
    expect(describeDatabaseError('plain string failure')).toBe('plain string failure');
    expect(describeDatabaseError(null)).toBe('null');
  });

  it('omits meta when only a code is present', () => {
    const error = new Error('connection refused') as Error & { code: string };
    error.code = 'P1001';
    const described = describeDatabaseError(error);
    expect(described).toContain('P1001');
    expect(described).not.toContain('meta');
  });
});
