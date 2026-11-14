import 'reflect-metadata';
import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import type { PaymentMethod, PrismVerifiedEventActor } from '@prism/types';
import { PaymentDetailsService } from './payment-details.service';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

const actorOf = (role: string, name = 'Ms. Mys'): PrismVerifiedEventActor =>
  ({ id: `${role}-1`, actorId: `${role}-1`, role, actorRole: role, name, actorName: name, email: `${role}@example.test`, actorEmail: `${role}@example.test`, expiresAt: '2099-01-01' }) as PrismVerifiedEventActor;
const pmcm = actorOf(OpsUserRole.PmcmAdmin);

const bpi: PaymentMethod = { kind: 'bank', id: '00000000-0000-4000-8000-000000000001', label: 'BPI', accountName: 'PMCM Events', accountNumber: '1234-5678', instructions: '', qrImageId: null, enabled: true };
const gcash: PaymentMethod = { kind: 'ewallet', id: '00000000-0000-4000-8000-000000000002', label: 'GCash', accountName: 'PMCM Finance', accountNumber: '0917 123 4567', instructions: '', qrImageId: null, enabled: true };

/** An in-memory stand-in for the two tables, with the same unique and revision rules the database enforces. */
function createService() {
  let row: { id: string; methods: unknown; revision: number; updatedBy: string; history: unknown; updatedAt: Date } | null = null;
  const images = new Map<string, { id: string; sha256: string; contentType: string; byteSize: number; bytes: Uint8Array }>();
  const audits: Array<{ action: string; metadata?: Record<string, unknown>; eventId?: string }> = [];
  const tables = {
    opsPmcmPaymentDetails: {
      findUnique: vi.fn(async () => row),
      findUniqueOrThrow: vi.fn(async () => row!),
      create: vi.fn(async ({ data }: { data: NonNullable<typeof row> }) => { row = { ...data, updatedAt: new Date('2026-11-15T00:00:00Z') }; return row; }),
      updateMany: vi.fn(async ({ where, data }: { where: { revision: number }; data: Partial<NonNullable<typeof row>> }) => {
        if (!row || row.revision !== where.revision) return { count: 0 };
        row = { ...row, ...data, updatedAt: new Date('2026-11-15T01:00:00Z') };
        return { count: 1 };
      }),
    },
    opsPmcmPaymentQrImage: {
      findMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) => [...images.values()].filter((image) => where.id.in.includes(image.id)).map(({ id }) => ({ id }))),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => images.get(where.id) ?? null),
      upsert: vi.fn(async ({ where, create }: { where: { sha256: string }; create: { id: string; sha256: string; contentType: string; byteSize: number; bytes: Uint8Array } }) => {
        const existing = [...images.values()].find((image) => image.sha256 === where.sha256);
        if (existing) return existing;
        images.set(create.id, create);
        return create;
      }),
    },
    $executeRaw: vi.fn(async () => 1),
  };
  const prisma = { ...tables, $transaction: async (work: (tx: typeof tables) => unknown) => work(tables) };
  const policy = new EventAccessPolicyService({ write: async () => undefined });
  const auditWriter = { write: vi.fn(async (input: { action: string; metadata?: Record<string, unknown>; eventId?: string }) => { audits.push(input); }) };
  const service = new PaymentDetailsService(prisma as never, policy, auditWriter as never);
  return { service, audits, images, tables };
}

describe('PMCM payment details', () => {
  it('saves the list as revision 1, audits what changed without account numbers, and reads it back', async () => {
    const { service, audits } = createService();
    expect(await service.read(pmcm)).toEqual({ revision: 0, methods: [], updatedBy: null, updatedAt: null });

    const saved = await service.save({ expectedRevision: 0, methods: [bpi, gcash] }, pmcm);

    expect(saved).toMatchObject({ revision: 1, updatedBy: 'Ms. Mys', methods: [bpi, gcash] });
    expect(audits).toEqual([expect.objectContaining({ action: 'Updated PMCM payment details', eventId: undefined, metadata: expect.objectContaining({ revision: 1, changes: ['Added BPI', 'Added GCash'] }) })]);
    expect(JSON.stringify(audits)).not.toContain('1234-5678');
    expect(await service.read(pmcm)).toMatchObject({ revision: 1, methods: [bpi, gcash] });
  });

  it('refuses a save made from an out-of-date copy, naming who saved last, and keeps the saved list', async () => {
    const { service, tables } = createService();
    await service.save({ expectedRevision: 0, methods: [bpi] }, pmcm);
    await service.save({ expectedRevision: 1, methods: [bpi, gcash] }, actorOf(OpsUserRole.PmcmAdmin, 'Maxine'));

    await expect(service.save({ expectedRevision: 1, methods: [{ ...bpi, accountNumber: '9999' }] }, pmcm)).rejects.toThrow(/last by Maxine.*reload/);
    await expect(service.save({ expectedRevision: 0, methods: [gcash] }, pmcm)).rejects.toThrow(/reload/);
    expect((await service.read(pmcm)).methods).toEqual([bpi, gcash]);
    expect(tables.opsPmcmPaymentDetails.updateMany).toHaveBeenCalledTimes(1);
  });

  it('does not make a new revision or audit entry when a save changes nothing', async () => {
    const { service, audits } = createService();
    await service.save({ expectedRevision: 0, methods: [bpi] }, pmcm);

    const again = await service.save({ expectedRevision: 1, methods: [bpi] }, pmcm);

    expect(again.revision).toBe(1);
    expect(audits).toHaveLength(1);
  });

  it('stores a QR once per image, refuses wrong or oversized files, and only lets a save point at an uploaded image', async () => {
    const { service, images } = createService();
    const first = await service.uploadQr(PNG, 'image/png', pmcm);
    const again = await service.uploadQr(Buffer.from(PNG), 'image/png', pmcm);

    expect(again.id).toBe(first.id);
    expect(images.size).toBe(1);
    expect(images.get(first.id)?.sha256).toBe(createHash('sha256').update(PNG).digest('hex'));
    await expect(service.uploadQr(PNG, 'image/jpeg', pmcm)).rejects.toThrow('does not match');
    await expect(service.uploadQr(Buffer.from('GIF89a'), 'image/png', pmcm)).rejects.toThrow('PNG or JPEG');

    await expect(service.save({ expectedRevision: 0, methods: [{ ...gcash, qrImageId: 'pqr_missing' }] }, pmcm)).rejects.toThrow('upload it again');
    expect((await service.read(pmcm)).revision).toBe(0);
    await expect(service.save({ expectedRevision: 0, methods: [{ ...gcash, qrImageId: first.id }] }, pmcm)).resolves.toMatchObject({ revision: 1 });
    expect(await service.readQr(first.id, pmcm)).toMatchObject({ contentType: 'image/png' });
    await expect(service.readQr('pqr_missing', pmcm)).rejects.toThrow('not found');
  });

  it.each([OpsUserRole.Coordinator, OpsUserRole.Client, OpsUserRole.Supplier])('refuses a %s on every read and write', async (role) => {
    const { service, tables } = createService();
    const other = actorOf(role);

    await expect(service.read(other)).rejects.toThrow();
    await expect(service.save({ expectedRevision: 0, methods: [bpi] }, other)).rejects.toThrow();
    await expect(service.uploadQr(PNG, 'image/png', other)).rejects.toThrow();
    await expect(service.readQr('pqr_any', other)).rejects.toThrow();
    expect(tables.opsPmcmPaymentDetails.create).not.toHaveBeenCalled();
    expect(tables.opsPmcmPaymentQrImage.upsert).not.toHaveBeenCalled();
  });
});
