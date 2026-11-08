import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventPrivacyService } from './event-privacy.service';

function setup(event: { archived: boolean; privacy: string } | null) {
  const tx = {
    opsEvent: {
      findUnique: vi.fn(async () => (event ? { id: 'evt_privacy', ...event } : null)),
      update: vi.fn(async () => undefined),
    },
  };
  const prisma = { $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) };
  const auditWriter = { write: vi.fn(async () => undefined) };
  const service = new EventPrivacyService(prisma as never, auditWriter as never);
  const actor = { id: 'pmcm-1', role: OpsUserRole.PmcmAdmin, email: 'pmcm@example.test', name: 'PMCM' } as never;
  return { service, tx, auditWriter, actor };
}

describe('EventPrivacyService', () => {
  it('lets PMCM mark an event public and audits the change from its previous setting', async () => {
    const { service, tx, auditWriter, actor } = setup({ archived: false, privacy: 'private' });

    await expect(service.setEventPrivacy('evt_privacy', { privacy: 'public' }, actor)).resolves.toEqual({ eventId: 'evt_privacy', privacy: 'public' });

    expect(tx.opsEvent.update).toHaveBeenCalledWith({ where: { id: 'evt_privacy' }, data: { privacy: 'public' } });
    expect(auditWriter.write).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.objectContaining({ from: 'private', to: 'public' }) }), expect.anything());
  });

  it('refuses to change the privacy of an archived event', async () => {
    const { service, tx, actor } = setup({ archived: true, privacy: 'private' });

    await expect(service.setEventPrivacy('evt_privacy', { privacy: 'public' }, actor)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.opsEvent.update).not.toHaveBeenCalled();
  });
});
