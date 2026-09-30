import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { SampleResetGuard } from '../guards/sample-reset.guard';
import { SampleStateGuard } from '../guards/sample-state.guard';
import { SAMPLE_COMPATIBILITY_CONTROLLERS } from './index';

function controllerPath(controller: Function): string {
  return Reflect.getMetadata('path', controller);
}

describe('sample-compatibility controller routes', () => {
  it('keeps public controller base paths stable', () => {
    // Sample compatibility owns the demo state/reset routes while capability modules own business controllers.
    expect(SAMPLE_COMPATIBILITY_CONTROLLERS.map(controllerPath).sort()).toEqual(['sample']);
  });

  it('requires the dedicated local reset guard before sample reset', () => {
    // The guard key and target checks are asserted in sample-reset.guard.test.ts.
    const resetGuards = Reflect.getMetadata('__guards__', SAMPLE_COMPATIBILITY_CONTROLLERS[0].prototype.reset);
    expect(resetGuards).toContain(SampleResetGuard);
  });

  it('requires a verified session before sample state is read', () => {
    // Previously unguarded on the reasoning that it is disabled in production,
    // which left it open on staging while returning supplier quote accessTokens.
    const stateGuards = Reflect.getMetadata('__guards__', SAMPLE_COMPATIBILITY_CONTROLLERS[0].prototype.state);
    expect(stateGuards).toContain(SampleStateGuard);
    // Each route carries its own guard because reset and state have different access rules.
    expect(Reflect.getMetadata('__guards__', SAMPLE_COMPATIBILITY_CONTROLLERS[0])).toBeUndefined();
  });
});
