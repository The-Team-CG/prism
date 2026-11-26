import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { EventAccessPolicyService, type AuditWriter } from '@prism/kernel/access-control';
import { roomScene } from '@prism/floorplan-scene';
import { createTemplateSchema, type PrismVerifiedEventActor } from '@prism/types';
import { EventSessionGuard } from '@prism/kernel/event-session';
import { PlansController } from './plans.controller';
import { TemplatesController } from './templates.controller';
import type { TemplatesService } from '../../application/authoring/templates.service';

function guardsFor(controller: Function, method: string) {
  const prototype = (controller as unknown as { prototype: Record<string, unknown> }).prototype;
  return Reflect.getMetadata('__guards__', prototype[method] as object);
}

describe('floorplan authoring session boundaries', () => {
  it('requires a verified event session for every authoring mutation', () => {
    expect(guardsFor(TemplatesController, 'create')).toContain(EventSessionGuard);
    expect(guardsFor(TemplatesController, 'update')).toContain(EventSessionGuard);
    expect(guardsFor(TemplatesController, 'delete')).toContain(EventSessionGuard);
    expect(guardsFor(PlansController, 'update')).toContain(EventSessionGuard);
  });

  it('requires a verified PMCM session for the global template inventory read', () => {
    expect(guardsFor(TemplatesController, 'list')).toContain(EventSessionGuard);
  });

  it('attributes new templates to the verified PMCM actor', async () => {
    const actor: PrismVerifiedEventActor = { sessionId: 'session_test',
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
    const input = createTemplateSchema.parse({ name: 'Corporate Gala', scene: roomScene({ name: 'Corporate Gala', widthM: 30, heightM: 20 }, '1.1.6').scene });

    await expect(controller.create(input, actor)).resolves.toEqual({ id: 'tpl_new' });
    expect(service.createTemplate).toHaveBeenCalledWith(input, actor.actorId);
  });

  it('keeps the venue library PMCM-only: clients cannot list, create, or edit presets', async () => {
    const service = {
      listTemplates: vi.fn().mockResolvedValue([]),
      createTemplate: vi.fn().mockResolvedValue({ id: 'tpl_new' }),
      updateTemplate: vi.fn().mockResolvedValue({ id: 'tpl_new' }),
    };
    const audit: AuditWriter = { write: vi.fn().mockResolvedValue(undefined) };
    const controller = new TemplatesController(
      service as unknown as TemplatesService,
      new EventAccessPolicyService(audit),
    );
    const client: PrismVerifiedEventActor = { sessionId: 'session_test',
      id: 'client_ana', actorId: 'client_ana', role: 'client', actorRole: 'client',
      name: 'Ana', actorName: 'Ana', email: 'ana@example.test', actorEmail: 'ana@example.test',
      expiresAt: '2099-01-01T00:00:00Z',
    };
    const input = createTemplateSchema.parse({ name: 'Corporate Gala', scene: roomScene({ name: 'Corporate Gala', widthM: 30, heightM: 20 }, '1.1.6').scene });

    await expect(controller.list(client)).rejects.toMatchObject({ status: 403 });
    await expect(controller.create(input, client)).rejects.toMatchObject({ status: 403 });
    await expect(controller.update('tpl_1', { name: 'Renamed Gala' }, client)).rejects.toMatchObject({ status: 403 });
    expect(service.listTemplates).not.toHaveBeenCalled();
    expect(service.createTemplate).not.toHaveBeenCalled();
    expect(service.updateTemplate).not.toHaveBeenCalled();
  });
});
