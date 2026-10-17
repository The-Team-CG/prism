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
  includeOrdinary?: boolean;
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
    failureReason: null as string | null,
    nextAttemptAt: new Date(Date.now() - 1_000),
    leaseToken: null as string | null,
    leaseExpiresAt: null as Date | null,
    createdAt: new Date('2026-10-17T00:00:00.000Z'),
  };
  const ordinary = {
    id: 'not_ordinary',
    eventId: 'evt_other',
    guestPassId: null,
    channel: 'email',
    recipient: 'other-guest@example.test',
    message: 'ordinary notification for another event',
    sensitivePayload: null,
    status: 'queued',
    attempts: 0,
    nextAttemptAt: new Date(Date.now() - 1_000),
    leaseToken: null as string | null,
    leaseExpiresAt: null as Date | null,
    createdAt: new Date('2026-10-16T00:00:00.000Z'),
  };
  const rows = options.includeOrdinary ? [ordinary, current] : [current];
  const prisma = {
    opsNotificationLog: {
      findMany: vi.fn(async ({ where }: { where?: { guestPassId?: { not?: string | null } } } = {}) =>
        rows.filter((row) => where?.guestPassId?.not !== null || row.guestPassId !== null).map((row) => ({ ...row }))),
      updateMany: vi.fn(async ({ where, data }: {
        where: { id?: string; status?: string; leaseToken?: string };
        data: Record<string, unknown>;
      }) => {
        const row = rows.find((candidate) => candidate.id === where.id);
        if (!row) return { count: 0 };
        if (where.status && where.status !== row.status) return { count: 0 };
        if (where.leaseToken && where.leaseToken !== row.leaseToken) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      }),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        sequence.push('reread');
        const row = rows.find((candidate) => candidate.id === where.id);
        if (options.supersedeLeaseOnRead && row?.id === current.id) row.leaseToken = 'another-worker-lease';
        return row ? { ...row } : null;
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

  return { current, ordinary, delivery, guestPassDeliveryEligibilityReader, prisma, sequence };
}

describe('notification delivery worker guest-pass handling', () => {
  it('leaves ordinary notifications queued while capturing eligible guest-pass deliveries', async () => {
    const harness = createHarness({ includeOrdinary: true });

    const processed = await processNotificationQueue(harness.prisma as never, harness.delivery, {
      encryptionKey: encryptionKeyText,
      guestPassDeliveryEligibilityReader: harness.guestPassDeliveryEligibilityReader,
    });

    expect(processed.map((row) => row.id)).toEqual(['not_guest_pass']);
    expect(harness.delivery.deliver).toHaveBeenCalledTimes(1);
    expect(harness.delivery.deliver).toHaveBeenCalledWith(expect.objectContaining({
      recipient: 'guest@example.test',
      message: plaintextMessage,
    }));
    expect(harness.ordinary).toMatchObject({
      eventId: 'evt_other',
      guestPassId: null,
      status: 'queued',
      attempts: 0,
      sensitivePayload: null,
      leaseToken: null,
      leaseExpiresAt: null,
    });
  });

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

  it('defers a temporary eligibility lookup error with the lease and ciphertext intact, then recovers', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-10-18T08:00:00.000Z'));
      const harness = createHarness();
      const ciphertext = harness.current.sensitivePayload;
      harness.guestPassDeliveryEligibilityReader.canDeliverGuestPass
        .mockRejectedValueOnce(new Error(`temporary lookup failure: ${plaintextMessage}`));

      await processNotificationQueue(harness.prisma as never, harness.delivery, {
        encryptionKey: encryptionKeyText,
        guestPassDeliveryEligibilityReader: harness.guestPassDeliveryEligibilityReader,
      });

      const retryAt = harness.current.nextAttemptAt;
      expect(retryAt.getTime()).toBeGreaterThan(Date.now());
      expect(retryAt.getTime()).toBeLessThan(Date.now() + 5 * 60_000);
      expect(harness.current).toMatchObject({
        status: 'queued',
        attempts: 0,
        guestPassId: 'pass_1',
        sensitivePayload: ciphertext,
        leaseToken: null,
        leaseExpiresAt: null,
        failureReason: 'Guest pass eligibility could not be verified; retry scheduled',
      });
      expect(harness.current.failureReason).not.toContain(plaintextMessage);
      expect(harness.delivery.deliver).not.toHaveBeenCalled();

      vi.setSystemTime(new Date(retryAt.getTime() + 1));
      const recovered = await processNotificationQueue(harness.prisma as never, harness.delivery, {
        encryptionKey: encryptionKeyText,
        guestPassDeliveryEligibilityReader: harness.guestPassDeliveryEligibilityReader,
      });

      expect(harness.guestPassDeliveryEligibilityReader.canDeliverGuestPass).toHaveBeenCalledTimes(2);
      expect(harness.delivery.deliver).toHaveBeenCalledOnce();
      expect(recovered[0]).toMatchObject({ status: 'captured', guestPassId: null, sensitivePayload: null });
      expect(harness.current).toMatchObject({ status: 'captured', guestPassId: 'pass_1', sensitivePayload: null });
    } finally {
      vi.useRealTimers();
    }
  });

  it('defers guest-pass delivery when the eligibility reader is unavailable', async () => {
    const harness = createHarness();
    const ciphertext = harness.current.sensitivePayload;

    await processNotificationQueue(harness.prisma as never, harness.delivery, { encryptionKey: encryptionKeyText });

    expect(harness.current).toMatchObject({
      status: 'queued',
      attempts: 0,
      guestPassId: 'pass_1',
      sensitivePayload: ciphertext,
      leaseToken: null,
      leaseExpiresAt: null,
      failureReason: 'Guest pass eligibility could not be verified; retry scheduled',
    });
    expect(harness.current.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
    expect(harness.delivery.deliver).not.toHaveBeenCalled();
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
