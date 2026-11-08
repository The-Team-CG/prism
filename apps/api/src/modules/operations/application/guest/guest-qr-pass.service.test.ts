import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { OpsUserRole } from '@prism/kernel/event-core';
import { guestQrCheckInSchema, guestQrPassToken } from '@prism/types';
import { GuestQrPassService } from './guest-qr-pass.service';

const pmcm = { id: 'usr_pmcm', role: OpsUserRole.PmcmAdmin, name: 'Maxine', email: 'pmcm@test', explicit: true, verified: true };
const staff = { ...pmcm, id: 'usr_reg', role: OpsUserRole.Coordinator };

type Row = { id: string; eventId: string; guestName: string; email: string; checkInToken: string | null; withdrawnAt: Date | null; eligibility: string; checkedInAt: Date | null };

function fixture() {
  const rows: Row[] = [
    { id: 'g1', eventId: 'evt_1', guestName: 'Ana', email: 'ana@test', checkInToken: null, withdrawnAt: null, eligibility: 'eligible', checkedInAt: null },
    { id: 'g2', eventId: 'evt_1', guestName: 'Ben', email: '', checkInToken: null, withdrawnAt: null, eligibility: 'eligible', checkedInAt: null },
    { id: 'g3', eventId: 'evt_1', guestName: 'Cy', email: 'cy@test', checkInToken: 'k'.repeat(32), withdrawnAt: null, eligibility: 'eligible', checkedInAt: null },
  ];
  const matches = (row: Row, where: Record<string, unknown>) => row.eventId === where.eventId
    && (where.checkInToken === undefined || row.checkInToken === where.checkInToken)
    && (!(where.NOT as Record<string, unknown> | undefined) || ('email' in (where.NOT as object) ? row.email !== '' : row.checkInToken !== null));
  const prisma = { opsGuestRosterEntry: {
    findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => rows.filter((row) => matches(row, where))),
    findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => rows.find((row) => matches(row, where)) ?? null),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => Object.assign(rows.find((row) => row.id === where.id)!, data)),
  } };
  const access = { requireActorRole: vi.fn(async (actor: { role: string }, roles: string[]) => { if (!roles.includes(actor.role)) throw new ForbiddenException('no'); }) };
  const guests = { checkInRosterEntry: vi.fn(async (_eventId: string, rosterEntryId: string) => ({ id: `gci_${rosterEntryId}` })) };
  const service = new GuestQrPassService(prisma as never, access as never, guests as never, { write: vi.fn(async () => undefined) } as never);
  return { service, rows, guests };
}

describe('FR-39 / FR-95 guest QR passes', () => {
  it('issues passes only to guests with an email, keeps existing tokens, and is PMCM-only', async () => {
    const f = fixture();
    const passes = await f.service.issuePasses('evt_1', pmcm);
    expect(passes.map((pass) => pass.guestName).sort()).toEqual(['Ana', 'Cy']);
    expect(f.rows.find((row) => row.id === 'g2')?.checkInToken).toBeNull();
    expect(f.rows.find((row) => row.id === 'g3')?.checkInToken).toBe('k'.repeat(32));
    expect(guestQrCheckInSchema.safeParse({ token: passes.find((pass) => pass.guestName === 'Ana')!.token }).success).toBe(true);
    await expect(f.service.issuePasses('evt_1', staff)).rejects.toThrow(ForbiddenException);
  });

  it('checks a scanned pass in through the roster check-in, and rejects a pass from another event', async () => {
    const f = fixture();
    const token = 'k'.repeat(32);
    expect(guestQrPassToken(`prism-pass:${token}`)).toBe(token);
    expect(guestQrPassToken(`https://guest.example/pass/${token}`)).toBe(token);
    await expect(f.service.checkInByToken('evt_1', token, staff)).resolves.toEqual({ id: 'gci_g3' });
    expect(f.guests.checkInRosterEntry).toHaveBeenCalledWith('evt_1', 'g3', staff);
    await expect(f.service.checkInByToken('evt_2', token, staff)).rejects.toThrow(NotFoundException);
  });
});
