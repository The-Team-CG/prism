import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventClosureService } from './event-closure.service';

describe('EventClosureService.searchArchive', () => {
  it('rejects a client actor from archive search', async () => {
    const access = {
      requireActorRole: async (actor: { role: string }, roles: string[], resource: string) => {
        if (!roles.includes(actor.role)) throw new ForbiddenException(`${actor.role} cannot access ${resource}`);
      },
    };
    const service = new EventClosureService(
      { opsEvent: { findMany: async () => [] } } as never,
      {} as never,
      {} as never,
      {} as never,
      access as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await expect(
      service.searchArchive({}, { role: OpsUserRole.Client, name: 'Ana', email: 'ana@ayala.test', explicit: true }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
