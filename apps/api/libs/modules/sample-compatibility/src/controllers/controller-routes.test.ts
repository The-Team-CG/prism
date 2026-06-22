import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { SAMPLE_COMPATIBILITY_CONTROLLERS } from './index';

function controllerPath(controller: Function): string {
  return Reflect.getMetadata('path', controller);
}

describe('sample-compatibility controller routes', () => {
  it('keeps public controller base paths stable', () => {
    // Sample compatibility owns the demo/seed/reset routes while capability modules own business controllers.
    expect(SAMPLE_COMPATIBILITY_CONTROLLERS.map(controllerPath).sort()).toEqual(['sample']);
  });
});
