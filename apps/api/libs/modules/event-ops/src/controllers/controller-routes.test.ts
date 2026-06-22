import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { EVENT_OPS_CONTROLLERS } from './index';

function controllerPath(controller: Function): string {
  return Reflect.getMetadata('path', controller);
}

describe('event-ops controller routes', () => {
  it('keeps public controller base paths stable', () => {
    // Live-ops route owners move out of event-ops in the live-ops child plan;
    // this registry should shrink when coordinator/supplier compatibility controllers lose their last handlers.
    expect(EVENT_OPS_CONTROLLERS.map(controllerPath).sort()).toEqual([
      'ai',
      'coordinator',
      'events',
      'sample',
      'supplier',
    ]);
  });
});
