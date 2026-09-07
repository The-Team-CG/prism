import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { EventSessionGuard } from '@prism/kernel/event-session';
import { LayoutEventsController } from './layout-events.controller';
import { PlansController } from './plans.controller';
import { PublishController } from './publish.controller';
import { TemplatesController } from './templates.controller';

function guardsFor(controller: Function, method: string) {
  const prototype = (controller as unknown as { prototype: Record<string, unknown> }).prototype;
  return Reflect.getMetadata('__guards__', prototype[method] as object);
}

describe('floorplan authoring session boundaries', () => {
  it('requires a verified event session for every authoring mutation', () => {
    expect(guardsFor(LayoutEventsController, 'create')).toContain(EventSessionGuard);
    expect(guardsFor(PublishController, 'publishEvent')).toContain(EventSessionGuard);
    expect(guardsFor(TemplatesController, 'create')).toContain(EventSessionGuard);
    expect(guardsFor(TemplatesController, 'update')).toContain(EventSessionGuard);
    expect(guardsFor(TemplatesController, 'delete')).toContain(EventSessionGuard);
    expect(guardsFor(PlansController, 'update')).toContain(EventSessionGuard);
  });
});
