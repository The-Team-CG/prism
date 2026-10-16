import { describe, expect, it, vi } from 'vitest';
import type { NotificationDeliveryPort } from '../../contracts/notifications/notification-delivery.port';
import { resolveGuestPassNotificationDelivery } from './notification-delivery.binding';

function adapter(deliveryMode: 'capture' | 'provider'): NotificationDeliveryPort {
  return {
    deliveryMode,
    deliver: vi.fn(async () => ({ status: 'captured' as const, receipt: 'capture_receipt' })),
  };
}

describe('guest-pass notification delivery binding', () => {
  it('does not bind demo delivery when the feature flag is off', () => {
    expect(resolveGuestPassNotificationDelivery('false', adapter('capture'))).toBeUndefined();
  });

  it('fails closed when demo delivery is enabled but the capture adapter is missing', () => {
    expect(() => resolveGuestPassNotificationDelivery('true')).toThrow(/capture-only/i);
  });

  it('fails closed when demo delivery is enabled with a provider adapter', () => {
    expect(() => resolveGuestPassNotificationDelivery('true', adapter('provider'))).toThrow(/capture-only/i);
  });

  it('binds the capture adapter when demo delivery is enabled', () => {
    const captureAdapter = adapter('capture');

    expect(resolveGuestPassNotificationDelivery('true', captureAdapter)).toBe(captureAdapter);
  });
});
