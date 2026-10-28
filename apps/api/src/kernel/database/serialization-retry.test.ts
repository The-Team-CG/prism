import { describe, expect, it, vi } from 'vitest';
import { isSerializationConflict, retryOnSerializationConflict } from './serialization-retry';

const conflict = () => Object.assign(new Error('Transaction failed due to a write conflict or a deadlock'), { code: 'P2034' });
const rawConflict = () => Object.assign(new Error('Raw query failed'), { code: 'P2010', meta: { message: 'ERROR: could not serialize access due to concurrent update' } });
const noWait = { sleep: async () => undefined };

describe('retryOnSerializationConflict', () => {
  it('runs a transaction once when nothing conflicts', async () => {
    const run = vi.fn(async () => 'ok');
    await expect(retryOnSerializationConflict(run, noWait)).resolves.toBe('ok');
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('runs the whole transaction again after a conflict, for both Prisma error shapes', async () => {
    const run = vi.fn<() => Promise<string>>()
      .mockRejectedValueOnce(conflict())
      .mockRejectedValueOnce(rawConflict())
      .mockResolvedValue('applied');
    await expect(retryOnSerializationConflict(run, noWait)).resolves.toBe('applied');
    expect(run).toHaveBeenCalledTimes(3);
  });

  it('gives up with the original conflict once the attempts are used', async () => {
    const error = conflict();
    const run = vi.fn(async () => { throw error; });
    await expect(retryOnSerializationConflict(run, { ...noWait, attempts: 3 })).rejects.toBe(error);
    expect(run).toHaveBeenCalledTimes(3);
  });

  it('never repeats other failures, which may not be safe to run twice', async () => {
    const duplicate = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
    const unrelatedRaw = Object.assign(new Error('Raw query failed'), { code: 'P2010', meta: { message: 'ERROR: syntax error' } });
    for (const error of [duplicate, unrelatedRaw, new Error('boom'), 'text', null]) {
      const run = vi.fn(async () => { throw error; });
      await expect(retryOnSerializationConflict(run, noWait)).rejects.toBe(error);
      expect(run).toHaveBeenCalledTimes(1);
    }
  });

  it('waits longer after each conflict', async () => {
    const waits: number[] = [];
    const run = vi.fn<() => Promise<string>>()
      .mockRejectedValueOnce(conflict()).mockRejectedValueOnce(conflict()).mockRejectedValueOnce(conflict())
      .mockResolvedValue('ok');
    await retryOnSerializationConflict(run, { sleep: async (ms) => { waits.push(ms); } });
    expect(waits).toHaveLength(3);
    expect(waits[0]).toBeLessThan(waits[2]);
  });
});

describe('isSerializationConflict', () => {
  it('recognises only conflicts', () => {
    expect(isSerializationConflict(conflict())).toBe(true);
    expect(isSerializationConflict(rawConflict())).toBe(true);
    expect(isSerializationConflict(Object.assign(new Error('x'), { code: 'P2025' }))).toBe(false);
    expect(isSerializationConflict(undefined)).toBe(false);
  });
});
