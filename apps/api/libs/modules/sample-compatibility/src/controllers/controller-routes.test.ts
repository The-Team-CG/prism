import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { SampleResetGuard } from '../guards/sample-reset.guard';
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
    // SampleResetGuard delegates to EventSessionGuard unless the local-development
    // bypass is explicitly configured; that delegation, and every condition under
    // which the bypass is refused, is asserted in sample-reset.guard.test.ts.
    const resetGuards = Reflect.getMetadata('__guards__', SAMPLE_COMPATIBILITY_CONTROLLERS[0].prototype.reset);
    expect(resetGuards).toContain(SampleResetGuard);
  });

  it('leaves sample state readable without a guard', () => {
    // /sample/state is intentionally unauthenticated; assert that the reset guard
    // was not applied to the whole controller by mistake.
    const stateGuards = Reflect.getMetadata('__guards__', SAMPLE_COMPATIBILITY_CONTROLLERS[0].prototype.state);
    expect(stateGuards).toBeUndefined();
    expect(Reflect.getMetadata('__guards__', SAMPLE_COMPATIBILITY_CONTROLLERS[0])).toBeUndefined();
  });
});
