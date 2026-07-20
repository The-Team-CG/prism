import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { EventSessionGuard } from '@prism/modules/event-session';
import { SAMPLE_COMPATIBILITY_CONTROLLERS } from './index';

function controllerPath(controller: Function): string {
  return Reflect.getMetadata('path', controller);
}

describe('sample-compatibility controller routes', () => {
  it('keeps public controller base paths stable', () => {
    // Sample compatibility owns the demo state/reset routes while capability modules own business controllers.
    expect(SAMPLE_COMPATIBILITY_CONTROLLERS.map(controllerPath).sort()).toEqual(['sample']);
  });

  it('requires a verified session before sample reset', () => {
    const resetGuards = Reflect.getMetadata('__guards__', SAMPLE_COMPATIBILITY_CONTROLLERS[0].prototype.reset);
    expect(resetGuards).toContain(EventSessionGuard);
  });
});
