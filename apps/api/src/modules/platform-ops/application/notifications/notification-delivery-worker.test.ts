import { createCipheriv, randomBytes } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type {
  NotificationDeliveryPort,
  NotificationDeliveryResult,
} from '../../contracts/notifications/notification-delivery.port';
import { processNotificationQueue } from './notification-delivery-worker';

const encryptionKey = Buffer.alloc(32, 17);
const encryptionKeyText = encryptionKey.toString('base64');
const plaintextMessage = 'Open https://guest.prism.test/e/EVT-DEMO#pass=high-entropy-secret';

function encryptedPayload(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey, iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `v1.${iv.toString('base64')}.${cipher.getAuthTag().toString('base64')}.${ciphertext.toString('base64')}`;
}

function createHarness(options: {
  eligible?: boolean;
  deliveryMode?: 'capture' | 'provider';
  deliveryResult?: NotificationDeliveryResult;
  deliveryError?: Error;
  supersedeLeaseOnRead?: boolean;
} = {}) {
  const sequence: string[] = [];
  const current = {
    id: 'not_guest_pass',
    eventId: 'evt_synthetic',
    guestPassId: 'pass_1',
    channel: 'email',
    recipient: 'guest@example.test',
    message: '[Guest pass delivery]',
    sensitivePayload: encryptedPayload(plaintextMessage),
    status: 'queued',
    attempts: 0,
    nextAttemptAt: new Date(Date.now() - 1_000),
    leaseToken: null as string | null,
    leaseExpiresAt: null as Date | null,
    createdAt: new Date('2026-10-17T00:00:00.000Z'),
  };
  const prisma = {
    opsNotificationLog: {
      findMany: vi.fn(async () => [{ ...current }]),
      updateMany: vi.fn(async ({ where, data }: {
        where: { id?: string; status?: string; leaseToken?: string };
        data: Record<string, unknown>;
      }) => {
        if (where.id && where.id !== current.id) return { count: 0 };
        if (where.status && where.status !== current.status) return { count: 0 };
        if (where.leaseToken && where.leaseToken !== current.leaseToken) return { count: 0 };
        Object.assign(current, data);
        return { count: 1 };
      }),
      findUnique: vi.fn(async () => {
        sequence.push('reread');
        if (options.supersedeLeaseOnRead) current.leaseToken = 'another-worker-lease';
        return { ...current };
      }),
    },
  };
  const guestPassDeliveryEligibilityReader = {
    canDeliverGuestPass: vi.fn(async () => {
      sequence.push('eligibility');
      return options.eligible ?? true;
    }),
  };
  const delivery: NotificationDeliveryPort = {
    deliveryMode: options.deliveryMode ?? 'capture',
    deliver: vi.fn(async () => {
      sequence.push('adapter');
      if (options.deliveryError) throw options.deliveryError;
      return options.deliveryResult ?? { status: 'captured' as const, receipt: 'capture_receipt_1' };
    }),
  };

  return { current, delivery, guestPassDeliveryEligibilityReader, prisma, sequence };
}

describe('notification delivery worker guest-pass handling', () => {
  it('decrypts only for a capture adapter and redacts after capture without marking sent', async () => {
    const harness = createHarness();

    const processed = await processNotificationQueue(harness.prisma as never, harness.delivery, {
      encryptionKey: encryptionKeyText,
      guestPassDeliveryEligibilityReader: harness.guestPassDeliveryEligibilityReader,
    });

    expect(harness.delivery.deliver).toHaveBeenCalledWith(expect.objectContaining({ message: plaintextMessage }));
    expect(harness.sequence.indexOf('reread')).toBeLessThan(harness.sequence.indexOf('adapter'));
    expect(processed[0]).toMatchObject({
      id: 'not_guest_pass',
      message: '[Guest pass delivery]',
      guestPassId: null,
      sensitivePayload: null,
      status: 'captured',
      providerReceipt: 'guest-pass-captured',
    });
    expect(processed[0].status).not.toBe('sent');
    expect(JSON.stringify(processed)).not.toContain(plaintextMessage);
    expect(harness.current.sensitivePayload).toBeNull();
  });

  it('rereads pass/event eligibility after claim and cancels/redacts a revoked pass before adapter invocation', async () => {
    const harness = createHarness({ eligible: false });

    await processNotificationQueue(harness.prisma as never, harness.delivery, {
      encryptionKey: encryptionKeyText,
      guestPassDeliveryEligibilityReader: harness.guestPassDeliveryEligibilityReader,
    });

    expect(harness.guestPassDeliveryEligibilityReader.canDeliverGuestPass).toHaveBeenCalledWith('pass_1', 'evt_synthetic');
    expect(harness.sequence.indexOf('reread')).toBeLessThan(harness.sequence.indexOf('eligibility'));
    expect(harness.delivery.deliver).not.toHaveBeenCalled();
    expect(harness.current).toMatchObject({ status: 'cancelled', sensitivePayload: null, leaseToken: null, leaseExpiresAt: null });
  });

  it('does not deliver or retain ciphertext when the demo worker is configured with provider mode', async () => {
    const harness = createHarness({ deliveryMode: 'provider' });

    await processNotificationQueue(harness.prisma as never, harness.delivery, {
      encryptionKey: encryptionKeyText,
      guestPassDeliveryEligibilityReader: harness.guestPassDeliveryEligibilityReader,
    });

    expect(harness.delivery.deliver).not.toHaveBeenCalled();
    expect(harness.current).toMatchObject({ status: 'cancelled', sensitivePayload: null });
  });

  it('retains ciphertext on a retryable failure only while pass and event remain eligible', async () => {
    const harness = createHarness({ deliveryError: new Error(plaintextMessage) });
    const ciphertext = harness.current.sensitivePayload;

    const processed = await processNotificationQueue(harness.prisma as never, harness.delivery, {
      encryptionKey: encryptionKeyText,
      guestPassDeliveryEligibilityReader: harness.guestPassDeliveryEligibilityReader,
    });

    expect(processed[0]).toMatchObject({ status: 'queued', attempts: 1, sensitivePayload: null, guestPassId: null });
    expect(JSON.stringify(processed)).not.toContain(ciphertext);
    expect(processed[0].failureReason).not.toContain(plaintextMessage);
    expect(JSON.stringify(processed)).not.toContain(plaintextMessage);
  });

  it('skips a stale lease observed by the post-claim reread', async () => {
    const harness = createHarness({ supersedeLeaseOnRead: true });

    await processNotificationQueue(harness.prisma as never, harness.delivery, {
      encryptionKey: encryptionKeyText,
      guestPassDeliveryEligibilityReader: harness.guestPassDeliveryEligibilityReader,
    });

    expect(harness.delivery.deliver).not.toHaveBeenCalled();
    expect(harness.guestPassDeliveryEligibilityReader.canDeliverGuestPass).not.toHaveBeenCalled();
  });
});
