import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { EmailSignInService } from './email-sign-in.service';

type User = { id: string; name: string; email: string; role: string; approvalStatus: string; permanentLockout: boolean };
type Code = { id: string; userId: string; codeHash: string; expiresAt: Date; attempts: number; consumedAt: Date | null; createdAt: Date };

const now = new Date('2026-12-01T02:00:00.000Z');

function fixture(users: User[]) {
  const codes: Code[] = [];
  const invitations = [{ userId: 'usr_invited', consumedAt: null as Date | null, revokedAt: null }];
  const limits = new Map<string, { windowStartedAt: Date; requestCount: number }>();
  const prisma: any = {
    opsUser: {
      findUnique: vi.fn(async ({ where }: { where: { email: string } }) => users.find((user) => user.email === where.email) ?? null),
      updateMany: vi.fn(async ({ where, data }: { where: { id: string; approvalStatus: string }; data: { approvalStatus: string } }) => {
        const user = users.find((row) => row.id === where.id && row.approvalStatus === where.approvalStatus);
        if (user) user.approvalStatus = data.approvalStatus;
        return { count: user ? 1 : 0 };
      }),
    },
    opsEmailSignInCode: {
      updateMany: vi.fn(async ({ where, data }: { where: { userId?: string; id?: string; consumedAt: null }; data: { consumedAt: Date } }) => {
        const hits = codes.filter((code) => code.consumedAt === null && (where.userId ? code.userId === where.userId : code.id === where.id));
        hits.forEach((code) => { code.consumedAt = data.consumedAt; });
        return { count: hits.length };
      }),
      create: vi.fn(async ({ data }: { data: Code }) => { codes.push({ ...data, attempts: data.attempts ?? 0, consumedAt: data.consumedAt ?? null }); return data; }),
      findFirst: vi.fn(async ({ where }: { where: { userId: string } }) => codes.filter((code) => code.userId === where.userId && !code.consumedAt && code.expiresAt > now).slice(-1)[0] ?? null),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<Code> }) => Object.assign(codes.find((code) => code.id === where.id)!, data)),
    },
    opsAccountInvitation: {
      updateMany: vi.fn(async ({ where, data }: { where: { userId: string }; data: { consumedAt: Date } }) => {
        const hits = invitations.filter((row) => row.userId === where.userId && !row.consumedAt);
        hits.forEach((row) => { row.consumedAt = data.consumedAt; });
        return { count: hits.length };
      }),
    },
    opsPasswordResetRateLimit: {
      upsert: vi.fn(async ({ where, create }: { where: { id: string }; create: { windowStartedAt: Date } }) => {
        const row = limits.get(where.id);
        if (row) { row.requestCount += 1; return row; }
        const fresh = { windowStartedAt: create.windowStartedAt, requestCount: 1 };
        limits.set(where.id, fresh);
        return fresh;
      }),
      update: vi.fn(),
    },
  };
  prisma.$transaction = vi.fn(async (work: (tx: unknown) => unknown) => work(prisma));
  const sent: Array<{ recipient: string; code: string; portalName: string }> = [];
  const delivery = { deliver: vi.fn(async (input: { recipient: string; code: string; portalName: string }) => { sent.push(input); }) };
  const authOperations = { signInWithVerifiedEmail: vi.fn(async (userId: string) => ({ accessToken: `token_${userId}` })) };
  const service = new EmailSignInService(prisma, authOperations as never, delivery, { write: vi.fn(async () => undefined) } as never);
  return { service, codes, sent, invitations, users, authOperations };
}

const client: User = { id: 'usr_client', name: 'Ana', email: 'ana@client.test', role: 'client', approvalStatus: 'approved', permanentLockout: false };
const invited: User = { id: 'usr_invited', name: 'Ben', email: 'ben@supplier.test', role: 'supplier', approvalStatus: 'invited', permanentLockout: false };
const admin: User = { id: 'usr_admin', name: 'Mys', email: 'mys@pmcm.test', role: 'pmcm-admin', approvalStatus: 'approved', permanentLockout: false };

describe('EmailSignInService (sign-in redesign)', () => {
  it('emails a client a six-digit code and signs them in with it, once', async () => {
    const f = fixture([{ ...client }]);
    await expect(f.service.request(' Ana@Client.test ', '10.0.0.1', now)).resolves.toEqual({ message: expect.stringContaining('If that email') });
    await vi.waitFor(() => expect(f.sent).toHaveLength(1));
    const { code, recipient, portalName } = f.sent[0]!;
    expect(code).toMatch(/^\d{6}$/);
    expect(recipient).toBe('ana@client.test');
    expect(portalName).toBe('client portal');
    // Only a hash is stored, never the code itself.
    expect(JSON.stringify(f.codes)).not.toContain(code);

    await expect(f.service.verify('ana@client.test', code, 'Firefox', now)).resolves.toEqual({ accessToken: 'token_usr_client' });
    await expect(f.service.verify('ana@client.test', code, 'Firefox', now)).rejects.toThrow('expired or was already used');
  });

  it('answers the same for unknown emails and PMCM staff, and sends them nothing', async () => {
    const f = fixture([{ ...admin }]);
    const unknown = await f.service.request('nobody@example.test', '10.0.0.1', now);
    const staff = await f.service.request('mys@pmcm.test', '10.0.0.1', now);
    expect(staff).toEqual(unknown);
    expect(f.sent).toHaveLength(0);
    await expect(f.service.verify('mys@pmcm.test', '123456', undefined, now)).rejects.toThrow(BadRequestException);
  });

  it('counts wrong tries and ends the code after five', async () => {
    const f = fixture([{ ...client }]);
    await f.service.request('ana@client.test', '10.0.0.1', now);
    await vi.waitFor(() => expect(f.sent).toHaveLength(1));
    const wrong = f.sent[0]!.code === '000000' ? '111111' : '000000';
    await expect(f.service.verify('ana@client.test', wrong, undefined, now)).rejects.toThrow('4 tries left');
    for (let i = 0; i < 3; i += 1) await f.service.verify('ana@client.test', wrong, undefined, now).catch(() => undefined);
    await expect(f.service.verify('ana@client.test', wrong, undefined, now)).rejects.toThrow('Too many wrong tries');
    await expect(f.service.verify('ana@client.test', f.sent[0]!.code, undefined, now)).rejects.toThrow('expired or was already used');
    expect(f.authOperations.signInWithVerifiedEmail).not.toHaveBeenCalled();
  });

  it('only the newest code works, and requests are limited per email and address', async () => {
    const f = fixture([{ ...client }]);
    await f.service.request('ana@client.test', '10.0.0.1', now);
    await f.service.request('ana@client.test', '10.0.0.1', now);
    await vi.waitFor(() => expect(f.sent).toHaveLength(2));
    if (f.sent[0]!.code !== f.sent[1]!.code) {
      await expect(f.service.verify('ana@client.test', f.sent[0]!.code, undefined, now)).rejects.toThrow('not right');
    }
    for (let i = 0; i < 4; i += 1) await f.service.request('ana@client.test', '10.0.0.1', now);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(f.sent).toHaveLength(5);
  });

  it('activates an invited supplier with their first code, without a password (first visit)', async () => {
    const f = fixture([{ ...invited }]);
    await f.service.request('ben@supplier.test', '10.0.0.2', now);
    await vi.waitFor(() => expect(f.sent).toHaveLength(1));
    expect(f.sent[0]!.portalName).toBe('supplier portal');
    await f.service.verify('ben@supplier.test', f.sent[0]!.code, undefined, now);
    expect(f.users[0]!.approvalStatus).toBe('approved');
    expect(f.invitations[0]!.consumedAt).toEqual(now);
    expect(f.authOperations.signInWithVerifiedEmail).toHaveBeenCalledWith('usr_invited', undefined);
  });
});
