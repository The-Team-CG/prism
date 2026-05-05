import { describe, expect, it, vi } from 'vitest';
import { TemplatesService } from './templates.service';

const createdAt = new Date('2026-05-06T00:00:00.000Z');

function templateRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tpl_demo',
    ownerId: 'owner_demo',
    name: 'Ballroom template',
    description: '',
    venue: '',
    venueRules: '',
    permanentFeatures: [],
    floorPlanId: 'plan_tpl_demo',
    pax: 0,
    includeGuests: false,
    includeSuppliers: false,
    guests: [],
    suppliers: [],
    sourceType: 'custom',
    createdAt,
    updatedAt: createdAt,
    floorPlan: {
      id: 'plan_tpl_demo',
      name: 'Ballroom template Base Layout',
      width: 30,
      height: 20,
      gridSize: 1,
      objects: [{ id: 'stage', kind: 'rect', x: 1, y: 2, w: 3, h: 4 }],
      objectRows: [],
    },
    ...overrides,
  };
}

function createService() {
  const prisma: any = {
    venueTemplate: {
      findMany: vi.fn().mockResolvedValue([templateRow()]),
      findUnique: vi.fn().mockResolvedValue(templateRow()),
      create: vi.fn().mockResolvedValue(templateRow()),
      update: vi.fn().mockResolvedValue(templateRow({ name: 'Renamed template' })),
      delete: vi.fn().mockResolvedValue(templateRow()),
    },
    floorPlan: {
      create: vi.fn().mockResolvedValue(templateRow().floorPlan),
      update: vi.fn().mockResolvedValue(templateRow().floorPlan),
    },
    $transaction: vi.fn(async (callback) => callback(prisma)),
  };

  return { service: new TemplatesService(prisma), prisma };
}

describe('TemplatesService', () => {
  it('lists templates with their persisted base layout objects', async () => {
    const { service } = createService();

    await expect(service.listTemplates()).resolves.toMatchObject([
      {
        id: 'tpl_demo',
        floorPlanId: 'plan_tpl_demo',
        objects: [{ id: 'stage' }],
        width: 30,
        height: 20,
        gridSize: 1,
      },
    ]);
  });

  it('deletes the template record without deleting event data through a cascade fallback', async () => {
    const { service, prisma } = createService();

    await expect((service as any).deleteTemplate('tpl_demo')).resolves.toMatchObject({ id: 'tpl_demo' });
    expect(prisma.venueTemplate.delete).toHaveBeenCalledWith({ where: { id: 'tpl_demo' } });
  });
});
