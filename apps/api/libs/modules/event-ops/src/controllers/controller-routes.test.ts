import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { EVENT_OPS_CONTROLLERS } from './index';

function controllerPath(controller: Function): string {
  return Reflect.getMetadata('path', controller);
}

describe('event-ops controller routes', () => {
  it('keeps public controller base paths stable', () => {
    // Controller ownership now lives in capability modules; event-ops only keeps compatibility controllers.
    expect(EVENT_OPS_CONTROLLERS.map(controllerPath).sort()).toEqual(['sample']);
  });
});
