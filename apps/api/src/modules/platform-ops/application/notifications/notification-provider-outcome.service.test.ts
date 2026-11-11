import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotificationProviderOutcomeService } from './notification-provider-outcome.service';
import { ResendWebhookService } from './resend-webhook.service';
import { ResendNotificationOutcomeReader } from '../../infrastructure/notifications/resend-notification-outcome.reader';

afterEach(() => vi.unstubAllGlobals());

function outcomePrisma(keptOutcome: string) {
  const deliveryUpdate = vi.fn(async () => ({ count: 1 }));
  const outcomeCreate = vi.fn(async () => ({ count: 1 }));
  const outcomeAdvance = vi.fn(async () => ({ count: 1 }));
  const prisma = {
    opsNotificationDelivery: {
      findFirst: vi.fn(async (args: { select?: unknown }) => args.select ? { providerOutcome: keptOutcome } : { id: 'delivery', providerReceipt: 'provider-id', status: 'accepted' }),
      updateMany: deliveryUpdate,
    },
    opsNotificationProviderOutcome: { createMany: outcomeCreate, updateMany: outcomeAdvance, findUniqueOrThrow: vi.fn(async () => ({ outcome: keptOutcome })), findUnique: vi.fn(async () => ({ outcome: keptOutcome })) },
  };
  return { prisma, deliveryUpdate, outcomeCreate, outcomeAdvance };
}

describe('email provider outcomes', () => {
  it('retrieves the exact accepted receipt for PMCM, records it forward-only, and leaves acknowledgment untouched', async () => {
    const { prisma, deliveryUpdate, outcomeCreate, outcomeAdvance } = outcomePrisma('bounced');
    const config = { get: (key: string) => key === 'PRISM_MAIL_TRANSPORT' ? 'resend' : 'private-test-key' };
    const service = new NotificationProviderOutcomeService(prisma as never, new ResendNotificationOutcomeReader(config as never));
    const fetcher = vi.fn(async () => ({ ok: true, json: async () => ({ id: 'provider-id', last_event: 'bounced', text: 'private message' }) }));
    vi.stubGlobal('fetch', fetcher);
    await expect(service.refreshEmail('notification', 'delivery', { role: 'client' } as never)).rejects.toThrow('Only PMCM');
    expect(fetcher).not.toHaveBeenCalled();
    await expect(service.refreshEmail('notification', 'delivery', { role: 'pmcm-admin' } as never)).resolves.toEqual({ id: 'delivery', providerOutcome: 'bounced' });
    // The report is stored for the receipt and may only replace an earlier outcome on the delivery.
    expect(outcomeCreate).toHaveBeenCalledWith({ data: [{ receipt: 'provider-id', outcome: 'bounced' }], skipDuplicates: true });
    expect(outcomeAdvance).toHaveBeenCalledWith({ where: { receipt: 'provider-id', outcome: { in: expect.arrayContaining(['delivered', 'opened']) } }, data: { outcome: 'bounced' } });
    expect(deliveryUpdate).toHaveBeenCalledWith({ where: expect.objectContaining({ providerReceipt: 'provider-id', notification: { channel: 'email' } }), data: { providerOutcome: 'bounced' } });
    fetcher.mockResolvedValue({ ok: true, json: async () => ({ id: 'wrong-id', last_event: 'delivered', text: 'private message' }) });
    await expect(service.refreshEmail('notification', 'delivery', { role: 'pmcm-admin' } as never)).rejects.toThrow('Unable to retrieve');
    expect(deliveryUpdate).toHaveBeenCalledTimes(1);
  });
});

describe('Resend delivery webhook', () => {
  const key = Buffer.from('webhook-test-signing-key');
  const secret = `whsec_${key.toString('base64')}`;
  const now = new Date('2026-11-11T10:00:00.000Z');
  const stamp = String(Math.floor(now.getTime() / 1000));
  const signed = (body: string) => ({ id: 'msg_1', timestamp: stamp, signature: `v1,${createHmac('sha256', key).update(`msg_1.${stamp}.${body}`).digest('base64')}` });
  const build = (configured = true) => {
    const recordEmailOutcome = vi.fn(async () => undefined);
    const service = new ResendWebhookService({ get: () => configured ? secret : undefined } as never, { recordEmailOutcome } as never);
    return { service, recordEmailOutcome };
  };

  it('records a signed delivery event against the email it names, and ignores events it does not track', async () => {
    const { service, recordEmailOutcome } = build();
    const delivered = JSON.stringify({ type: 'email.delivered', data: { email_id: 'abc' } });
    await expect(service.handle(Buffer.from(delivered), signed(delivered), now)).resolves.toEqual({});
    expect(recordEmailOutcome).toHaveBeenCalledWith('abc', 'delivered');
    const unrelated = JSON.stringify({ type: 'domain.updated', data: { email_id: 'abc' } });
    await service.handle(Buffer.from(unrelated), signed(unrelated), now);
    expect(recordEmailOutcome).toHaveBeenCalledTimes(1);
  });

  it('refuses unsigned, tampered or unconfigured requests before reading them, and rejects a malformed signed body', async () => {
    const { service, recordEmailOutcome } = build();
    const body = JSON.stringify({ type: 'email.bounced', data: { email_id: 'abc' } });
    await expect(service.handle(Buffer.from(body), { id: 'msg_1', timestamp: stamp }, now)).rejects.toThrow('Invalid Resend signature');
    await expect(service.handle(Buffer.from(body.replace('bounced', 'delivered')), signed(body), now)).rejects.toThrow('Invalid Resend signature');
    await expect(service.handle(undefined, signed(body), now)).rejects.toThrow('Invalid Resend signature');
    const malformed = JSON.stringify({ type: 'email.bounced', data: {} });
    await expect(service.handle(Buffer.from(malformed), signed(malformed), now)).rejects.toThrow('Invalid Resend webhook');
    await expect(build(false).service.handle(Buffer.from(body), signed(body), now)).rejects.toThrow('not configured');
    expect(recordEmailOutcome).not.toHaveBeenCalled();
  });
});
