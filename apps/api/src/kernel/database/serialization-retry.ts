import { randomInt } from 'node:crypto';

const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 25;

/**
 * Postgres aborts one of two overlapping serializable transactions (SQLSTATE 40001). Prisma reports it as
 * P2034, or as P2010 when it came from a raw query. Nothing was applied, so the whole transaction can run again.
 */
export function isSerializationConflict(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { code, message, meta } = error as { code?: unknown; message?: unknown; meta?: unknown };
  if (code === 'P2034') return true;
  const text = `${typeof message === 'string' ? message : ''} ${JSON.stringify(meta ?? '')}`;
  return code === 'P2010' && /could not serialize access|40001/.test(text);
}

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Runs a whole transaction again, with a short jittered backoff, when it lost a serialization conflict. Every
 * audited write updates one audit-chain row, so overlapping writes anywhere in the API collide there.
 */
export async function retryOnSerializationConflict<T>(
  run: () => Promise<T>,
  { attempts = MAX_ATTEMPTS, sleep = pause }: { attempts?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      if (attempt >= attempts || !isSerializationConflict(error)) throw error;
      await sleep(BASE_DELAY_MS * 2 ** (attempt - 1) + randomInt(0, BASE_DELAY_MS));
    }
  }
}
