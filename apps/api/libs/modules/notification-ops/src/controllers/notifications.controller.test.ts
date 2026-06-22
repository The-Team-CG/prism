import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { OpsNotificationsController } from './notifications.controller';

function controllerPath(controller: Function): string {
  return Reflect.getMetadata('path', controller);
}

describe('OpsNotificationsController', () => {
  it('keeps the public notifications route base stable under notification-ops ownership', () => {
    expect(controllerPath(OpsNotificationsController)).toBe('notifications');
  });

  it('acknowledges notifications through NotificationOutboxService and maps the response', async () => {
    const acknowledgedAt = new Date('2026-06-20T10:00:00.000Z');
    const notificationOutboxService = {
      acknowledge: vi.fn(async () => ({
        id: 'not_sample',
        eventId: 'evt_sample',
        channel: 'email',
        recipient: 'client@example.test',
        message: 'Client portal unlocked',
        status: 'acknowledged',
        attempts: 1,
        correlationId: 'corr_1',
        failureReason: null,
        sentAt: null,
        failedAt: null,
        acknowledgedAt,
        createdAt: new Date('2026-06-20T09:00:00.000Z'),
      })),
    };
    const controller = new OpsNotificationsController(notificationOutboxService as any);

    await expect(controller.acknowledge('not_sample')).resolves.toEqual({
      id: 'not_sample',
      eventId: 'evt_sample',
      channel: 'email',
      recipient: 'client@example.test',
      message: 'Client portal unlocked',
      status: 'acknowledged',
      attempts: 1,
      correlationId: 'corr_1',
      failureReason: null,
      sentAt: null,
      failedAt: null,
      acknowledgedAt: '2026-06-20T10:00:00.000Z',
      createdAt: '2026-06-20T09:00:00.000Z',
    });
    expect(notificationOutboxService.acknowledge).toHaveBeenCalledWith('not_sample');
  });
});
