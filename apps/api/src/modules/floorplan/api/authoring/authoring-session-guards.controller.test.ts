import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { EventAccessPolicyService, type AuditWriter } from '@prism/kernel/access-control';
import { createTemplateSchema, type PrismVerifiedEventActor } from '@prism/types';
import type { PublishService } from '../../application/authoring/publish.service';
import { EventSessionGuard } from '@prism/kernel/event-session';
import { LayoutEventsController } from './layout-events.controller';
import { PlansController } from './plans.controller';
import { PublishController } from './publish.controller';
import { TemplatesController } from './templates.controller';
import type { TemplatesService } from '../../application/authoring/templates.service';

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

  it('requires a verified PMCM session for global event/template inventory reads', () => {
    expect(guardsFor(LayoutEventsController, 'list')).toContain(EventSessionGuard);
    expect(guardsFor(TemplatesController, 'list')).toContain(EventSessionGuard);
    expect(guardsFor(TemplatesController, 'getOne')).toContain(EventSessionGuard);
    expect(guardsFor(PublishController, 'getSnapshot')).toContain(EventSessionGuard);
  });

  it('denies clients access to raw published layouts, including guest and supplier data', async () => {
    const service = { getPublishedLayout: vi.fn().mockResolvedValue({ id: 'snapshot' }) };
    const audit: AuditWriter = { write: vi.fn().mockResolvedValue(undefined) };
    const policy = new EventAccessPolicyService(audit);
    const controller = new PublishController(service as unknown as PublishService, policy);
    const client: PrismVerifiedEventActor = {
      id: 'client', actorId: 'client', role: 'client', actorRole: 'client',
      name: 'Client', actorName: 'Client', email: 'client@test', actorEmail: 'client@test',
      expiresAt: '2099-01-01T00:00:00Z',
    };
    await expect(controller.getSnapshot('event-short-id', client)).rejects.toMatchObject({ status: 403 });
    expect(service.getPublishedLayout).not.toHaveBeenCalled();
    await expect(controller.getSnapshot('event-short-id', { ...client, role: 'pmcm-admin', actorRole: 'pmcm-admin' })).resolves.toEqual({ id: 'snapshot' });
  });
  it('attributes new templates to the verified PMCM actor', async () => {
    const actor: PrismVerifiedEventActor = {
      id: 'user_pmcm_1',
      actorId: 'user_pmcm_1',
      role: 'pmcm-admin',
      actorRole: 'pmcm-admin',
      email: 'pmcm@example.test',
      actorEmail: 'pmcm@example.test',
      name: 'Maxine',
      actorName: 'Maxine',
      expiresAt: '2099-01-01T00:00:00Z',
    };
    const service = { createTemplate: vi.fn().mockResolvedValue({ id: 'tpl_new' }) };
    const audit: AuditWriter = { write: vi.fn().mockResolvedValue(undefined) };
    const controller = new TemplatesController(
      service as unknown as TemplatesService,
      new EventAccessPolicyService(audit),
    );
    const input = createTemplateSchema.parse({ name: 'Corporate Gala' });

    await expect(controller.create(input, actor)).resolves.toEqual({ id: 'tpl_new' });
    expect(service.createTemplate).toHaveBeenCalledWith(input, actor.actorId);
  });
});
