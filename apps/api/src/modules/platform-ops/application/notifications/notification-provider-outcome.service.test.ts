import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotificationProviderOutcomeService } from './notification-provider-outcome.service';
import { ResendNotificationOutcomeReader } from '../../infrastructure/notifications/resend-notification-outcome.reader';

afterEach(() => vi.unstubAllGlobals());
describe('email provider outcomes', () => {
  it('retrieves the exact accepted receipt for PMCM without changing acknowledgment or delivery acceptance', async () => {
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const prisma = { opsNotificationDelivery: { findFirst: vi.fn(async () => ({ id: 'delivery', providerReceipt: 'provider-id', status: 'accepted' })), updateMany } };
    const config = { get: (key: string) => key === 'PRISM_MAIL_TRANSPORT' ? 'resend' : 'private-test-key' };
    const service = new NotificationProviderOutcomeService(prisma as never, new ResendNotificationOutcomeReader(config as never));
    const fetcher = vi.fn(async () => ({ ok: true, json: async () => ({ id: 'provider-id', last_event: 'bounced', text: 'private message' }) }));
    vi.stubGlobal('fetch', fetcher);
    await expect(service.refreshEmail('notification', 'delivery', { role: 'client' } as never)).rejects.toThrow('Only PMCM');
    expect(fetcher).not.toHaveBeenCalled();
    await expect(service.refreshEmail('notification', 'delivery', { role: 'pmcm-admin' } as never)).resolves.toEqual({ id: 'delivery', providerOutcome: 'bounced' });
    expect(updateMany).toHaveBeenCalledWith({ where: { id: 'delivery', providerReceipt: 'provider-id' }, data: { providerOutcome: 'bounced' } });
    fetcher.mockResolvedValue({ ok: true, json: async () => ({ id: 'wrong-id', last_event: 'delivered', text: 'private message' }) });
    await expect(service.refreshEmail('notification', 'delivery', { role: 'pmcm-admin' } as never)).rejects.toThrow('Unable to retrieve');
    expect(updateMany).toHaveBeenCalledTimes(1);
  });
});
