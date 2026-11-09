import { createHmac } from 'node:crypto';
import { BadRequestException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { viberConfigProblems } from '@prism/kernel/shared';
import { ViberBotClient } from '../../infrastructure/notifications/viber-bot.client';
import { ChannelNotificationDeliveryAdapter } from '../../infrastructure/notifications/channel-notification-delivery.adapter';
import { NotificationPreferenceService } from './notification-preference.service';

type Row = { email: string; viberUserId: string | null; viberEnabled: boolean; viberLinkedAt: Date | null; linkCodeHash: string | null; linkCodeExpiresAt: Date | null; updatedAt: Date };
const AUTH_TOKEN = 'viber-test-token';
const now = new Date('2026-11-11T08:00:00.000Z');

function store() {
  const rows: Row[] = [];
  const matches = (row: Row, where: Record<string, any>) => Object.entries(where).every(([key, value]) => {
    if (value && typeof value === 'object' && 'not' in value) return value.not === null ? (row as any)[key] != null : (row as any)[key] !== value.not;
    if (value && typeof value === 'object' && 'in' in value) return value.in.includes((row as any)[key]);
    return (row as any)[key] === value;
  });
  const table = {
    findUnique: vi.fn(async ({ where }: any) => rows.find((row) => matches(row, where)) ?? null),
    findMany: vi.fn(async ({ where }: any) => rows.filter((row) => matches(row, where)).map((row) => ({ ...row }))),
    upsert: vi.fn(async ({ where, create, update }: any) => {
      const found = rows.find((row) => row.email === where.email);
      if (found) return Object.assign(found, update);
      const row = { viberUserId: null, viberEnabled: false, viberLinkedAt: null, linkCodeHash: null, linkCodeExpiresAt: null, updatedAt: now, ...create };
      rows.push(row);
      return row;
    }),
    update: vi.fn(async ({ where, data }: any) => Object.assign(rows.find((row) => row.email === where.email)!, data)),
    updateMany: vi.fn(async ({ where, data }: any) => { const hit = rows.filter((row) => matches(row, where)); hit.forEach((row) => Object.assign(row, data)); return { count: hit.length }; }),
  };
  const prisma: any = { opsNotificationChannelPreference: table };
  prisma.$transaction = vi.fn(async (work: (tx: unknown) => unknown) => work(prisma));
  return { rows, prisma };
}

const fetchOk = (status = 0) => vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ status, message_token: 42 }) }));
const actor = (email: string) => ({ actorEmail: email }) as never;
const signed = (body: object) => {
  const raw = Buffer.from(JSON.stringify(body));
  return { raw, signature: createHmac('sha256', AUTH_TOKEN).update(raw).digest('hex') };
};

describe('Viber notification channel (FR-25)', () => {
  it('links an account through a one-time code opened in the bot, and refuses unsigned callbacks', async () => {
    const { prisma, rows } = store();
    const viber = new ViberBotClient({ authToken: AUTH_TOKEN, botUri: 'prismpmcm', senderName: 'P.R.I.S.M' }, fetchOk());
    const service = new NotificationPreferenceService(prisma, viber);

    await expect(service.setViberEnabled(actor('ana@client.test'), true)).rejects.toBeInstanceOf(BadRequestException);
    const link = await service.startViberLink(actor('Ana@Client.test'), now);
    expect(link.deepLink).toBe(`viber://pa?chatURI=prismpmcm&context=${link.code}`);
    expect(rows[0]?.linkCodeHash).not.toContain(link.code);

    const forged = signed({ event: 'conversation_started', context: link.code, user: { id: 'viber_ana' } });
    await expect(service.handleViberCallback(forged.raw, 'f'.repeat(64), now)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(rows[0]?.viberUserId).toBeNull();

    const welcome = await service.handleViberCallback(forged.raw, forged.signature, now);
    expect(welcome).toMatchObject({ type: 'text', text: expect.stringContaining('are on') });
    await expect(service.get(actor('ana@client.test'))).resolves.toMatchObject({ viberConfigured: true, viberLinked: true, viberEnabled: true });

    // The code is single use and an expired code links nothing.
    const reuse = signed({ event: 'conversation_started', context: link.code, user: { id: 'viber_other' } });
    await expect(service.handleViberCallback(reuse.raw, reuse.signature, now)).resolves.toMatchObject({ text: expect.stringContaining('Link Viber') });

    const left = signed({ event: 'unsubscribed', user_id: 'viber_ana' });
    await service.handleViberCallback(left.raw, left.signature, now);
    await expect(service.get(actor('ana@client.test'))).resolves.toMatchObject({ viberLinked: false, viberEnabled: false });
  });

  it('is unavailable without a configured bot, and config needs both variables or neither', async () => {
    const service = new NotificationPreferenceService(store().prisma, null);
    await expect(service.startViberLink(actor('ana@client.test'))).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(service.get(actor('ana@client.test'))).resolves.toMatchObject({ viberConfigured: false });
    expect(viberConfigProblems(() => undefined)).toEqual([]);
    expect(viberConfigProblems((name) => (name === 'VIBER_AUTH_TOKEN' ? 'x' : undefined)).map((problem) => problem.name)).toEqual(['VIBER_BOT_URI']);
  });

  it('delivers Viber rows only to linked accounts that kept Viber on, and skips the rest', async () => {
    const { prisma, rows } = store();
    rows.push({ email: 'ana@client.test', viberUserId: 'viber_ana', viberEnabled: true, viberLinkedAt: now, linkCodeHash: null, linkCodeExpiresAt: null, updatedAt: now });
    rows.push({ email: 'ben@client.test', viberUserId: 'viber_ben', viberEnabled: false, viberLinkedAt: now, linkCodeHash: null, linkCodeExpiresAt: null, updatedAt: now });
    const fetchImpl = fetchOk();
    const viber = new ViberBotClient({ authToken: AUTH_TOKEN, botUri: 'prismpmcm', senderName: 'P.R.I.S.M' }, fetchImpl);
    const preferences = new NotificationPreferenceService(prisma, viber);
    const mail = { deliver: vi.fn(async () => ({ status: 'accepted' as const, receipt: 'mail' })) };
    const adapter = new ChannelNotificationDeliveryAdapter(mail as never, preferences, {} as never, viber);
    const row = (recipient: string) => ({ idempotencyKey: 'n1', channel: 'viber', eventId: null, recipient, message: 'Billing statement BS-1 sent' });

    await expect(adapter.deliver(row('ana@client.test'))).resolves.toEqual({ status: 'accepted', receipt: '42' });
    expect(JSON.parse(((fetchImpl.mock.calls[0] as unknown[])[1] as { body: string }).body)).toMatchObject({ receiver: 'viber_ana', type: 'text', text: 'Billing statement BS-1 sent' });
    await expect(adapter.deliver(row('ben@client.test'))).resolves.toMatchObject({ status: 'skipped' });
    await expect(adapter.deliver({ ...row('ana@client.test'), channel: 'email' })).resolves.toEqual({ status: 'accepted', receipt: 'mail' });

    // A user who left the bot is unlinked so later rows stop trying.
    const gone = new ChannelNotificationDeliveryAdapter(mail as never, preferences, {} as never, new ViberBotClient({ authToken: AUTH_TOKEN, botUri: 'prismpmcm', senderName: 'P.R.I.S.M' }, fetchOk(6)));
    await expect(gone.deliver(row('ana@client.test'))).resolves.toMatchObject({ status: 'permanent_failure' });
    expect(rows[0]).toMatchObject({ viberUserId: null, viberEnabled: false });
  });
});
