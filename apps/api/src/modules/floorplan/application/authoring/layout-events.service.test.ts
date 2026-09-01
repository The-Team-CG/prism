import { describe, expect, it, vi } from 'vitest';
import { LayoutEventsService } from './layout-events.service';

describe('LayoutEventsService', () => {
  it('bounds the layout event list query', async () => {
    const prisma = {
      eventInstance: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'event_1',
            ownerId: 'owner_1',
            templateId: 'template_1',
            floorPlanId: 'plan_1',
            name: 'Sample event',
            startsAt: new Date('2026-09-01T09:00:00.000Z'),
            status: 'draft',
            createdAt: new Date('2026-08-31T09:00:00.000Z'),
          },
        ]),
      },
    };
    const service = new LayoutEventsService(prisma as never);

    await expect(service.listEvents()).resolves.toMatchObject([{ id: 'event_1' }]);
    expect(prisma.eventInstance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
  });
});
