import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventPrivacyService } from './event-privacy.service';

function setup(event: { archived: boolean; privacy?: string; coverObjectId?: string | null } | null) {
  const tx = {
    opsEvent: {
      findUnique: vi.fn(async () => (event ? { id: 'evt_privacy', ...event } : null)),
      update: vi.fn(async () => undefined),
    },
  };
  const prisma = { ...tx, $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) };
  const auditWriter = { write: vi.fn(async () => undefined) };
  const storage = { validateEventCoverReference: vi.fn(async () => undefined) };
  const service = new EventPrivacyService(prisma as never, auditWriter as never, storage as never);
  const actor = { id: 'pmcm-1', role: OpsUserRole.PmcmAdmin, email: 'pmcm@example.test', name: 'PMCM' } as never;
  return { service, tx, auditWriter, actor, storage };
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

  it('sets an image from the event files as its cover, checking the file first, and clears it again', async () => {
    const { service, tx, actor, storage, auditWriter } = setup({ archived: false, coverObjectId: null });

    await expect(service.setEventCover('evt_privacy', { objectId: 'obj_venue' }, actor)).resolves.toEqual({ eventId: 'evt_privacy', coverObjectId: 'obj_venue' });
    expect(storage.validateEventCoverReference).toHaveBeenCalledWith({ eventId: 'evt_privacy', objectId: 'obj_venue' });
    expect(tx.opsEvent.update).toHaveBeenCalledWith({ where: { id: 'evt_privacy' }, data: { coverObjectId: 'obj_venue' } });
    expect(auditWriter.write).toHaveBeenCalledTimes(1);

    storage.validateEventCoverReference.mockClear();
    tx.opsEvent.findUnique.mockResolvedValueOnce({ id: 'evt_privacy', archived: false, coverObjectId: 'obj_venue' } as never);
    await service.setEventCover('evt_privacy', { objectId: null }, actor);
    expect(storage.validateEventCoverReference).not.toHaveBeenCalled();
    expect(tx.opsEvent.update).toHaveBeenLastCalledWith({ where: { id: 'evt_privacy' }, data: { coverObjectId: null } });
  });

  it('keeps the cover when the chosen file is not a usable image, and refuses archived events', async () => {
    const { service, tx, actor, storage } = setup({ archived: false, coverObjectId: null });
    storage.validateEventCoverReference.mockRejectedValueOnce(new BadRequestException('Choose an image file as the cover'));
    await expect(service.setEventCover('evt_privacy', { objectId: 'obj_pdf' }, actor)).rejects.toThrow('Choose an image file');
    expect(tx.opsEvent.update).not.toHaveBeenCalled();

    const archived = setup({ archived: true, coverObjectId: null });
    await expect(archived.service.setEventCover('evt_privacy', { objectId: 'obj_venue' }, archived.actor)).rejects.toBeInstanceOf(BadRequestException);
  });
});
