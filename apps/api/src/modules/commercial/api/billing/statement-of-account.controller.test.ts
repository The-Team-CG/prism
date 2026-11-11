import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { StatementOfAccountController } from './statement-of-account.controller';

describe('StatementOfAccountController', () => {
  it('serves under the events route base and hands the verified actor to the service, which owns every access rule', async () => {
    const service = { statementFor: vi.fn(async (eventId: string) => ({ eventId })) };
    const controller = new StatementOfAccountController(service as never);
    const verified = { id: 'user_1', actorRole: 'client' } as never;

    await expect(controller.statementOfAccount('evt_1', verified)).resolves.toEqual({ eventId: 'evt_1' });

    expect(Reflect.getMetadata('path', StatementOfAccountController)).toBe('events');
    expect(service.statementFor).toHaveBeenCalledWith('evt_1', verified);
  });
});
