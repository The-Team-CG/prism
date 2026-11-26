import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { OpsNotificationsController } from './notifications.controller';

function controllerPath(controller: Function): string {
  return Reflect.getMetadata('path', controller);
}

describe('OpsNotificationsController', () => {
  it('keeps the public notifications route base stable under notification-ops ownership', () => {
    expect(controllerPath(OpsNotificationsController)).toBe('notifications');
  });
});
