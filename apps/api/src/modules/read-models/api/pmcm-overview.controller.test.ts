import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { OpsPmcmOverviewController } from './pmcm-overview.controller';

describe('OpsPmcmOverviewController', () => {
  it('keeps both reads under the PMCM route base', () => {
    expect(Reflect.getMetadata('path', OpsPmcmOverviewController)).toBe('pmcm');
    expect(Reflect.getMetadata('path', OpsPmcmOverviewController.prototype.eventSummaries)).toBe('event-summaries');
    expect(Reflect.getMetadata('path', OpsPmcmOverviewController.prototype.fileSummaries)).toBe('file-summaries');
    expect(Reflect.getMetadata('path', OpsPmcmOverviewController.prototype.calendar)).toBe('calendar');
  });

  it('resolves the verified actor and passes it, with the validated window, to the service', async () => {
    const overview = { eventSummaries: vi.fn(async () => ({ items: [] })), fileSummaries: vi.fn(async () => ({ items: [] })), calendar: vi.fn(async () => ({ items: [] })) };
    const policy = { resolveActor: vi.fn((_input: unknown, verified: { actorRole: string }) => ({ role: verified.actorRole })) };
    const controller = new OpsPmcmOverviewController(overview as never, policy as never);
    const verified = { actorRole: 'pmcm-admin' } as never;

    await controller.eventSummaries(verified);
    await controller.fileSummaries(verified);
    await controller.calendar({ from: '2026-11-01', to: '2026-11-30' }, verified);

    expect(overview.eventSummaries).toHaveBeenCalledWith({ role: 'pmcm-admin' });
    expect(overview.fileSummaries).toHaveBeenCalledWith({ role: 'pmcm-admin' });
    expect(overview.calendar).toHaveBeenCalledWith({ role: 'pmcm-admin' }, { from: '2026-11-01', to: '2026-11-30' });
  });
});
