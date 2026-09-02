import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  FloorPlan as PrismaFloorPlan,
  FloorPlanObject as PrismaFloorPlanObject,
  Prisma,
  VenueTemplate as PrismaVenueTemplate,
} from '@prisma/client';
import { PrismaService, toPrismaJson } from '@prism/kernel/database';
import { asArray } from '@prism/kernel/shared';
import type { CanvasObject, JsonValue, VenueTemplate } from '@prism/kernel/shared';
import { randomUUID } from 'node:crypto';
import { DEFAULT_OWNER_ID, defaultSeatCategories } from '@prism/kernel/shared';
import {
  floorPlanScalarPatch,
  jsonIfDefined,
  replaceFloorPlanObjects,
  setIfDefined,
} from './plan-patch';

const TEMPLATE_LIST_LIMIT = 100;
const TEMPLATE_PLAN_KEYS = ['objects', 'width', 'height', 'gridSize', 'venue', 'pax', 'guests', 'suppliers'] as const;

type TemplateUpdateInput = {
  name?: string;
  description?: string;
  venue?: string;
  venueRules?: string;
  permanentFeatures?: CanvasObject[];
  objects?: CanvasObject[];
  width?: number;
  height?: number;
  gridSize?: number;
  pax?: number;
  includeGuests?: boolean;
  includeSuppliers?: boolean;
  guests?: unknown[];
  suppliers?: unknown[];
  sourceType?: string;
};

function templateRowPatch(input: TemplateUpdateInput): Prisma.VenueTemplateUpdateInput {
  const data: Record<string, unknown> = {};
  setIfDefined(data, 'name', input.name);
  setIfDefined(data, 'description', input.description);
  setIfDefined(data, 'venue', input.venue);
  setIfDefined(data, 'venueRules', input.venueRules);
  jsonIfDefined(data, 'permanentFeatures', input.permanentFeatures);
  setIfDefined(data, 'pax', input.pax);
  setIfDefined(data, 'includeGuests', input.includeGuests);
  setIfDefined(data, 'includeSuppliers', input.includeSuppliers);
  jsonIfDefined(data, 'guests', input.guests);
  jsonIfDefined(data, 'suppliers', input.suppliers);
  setIfDefined(data, 'sourceType', input.sourceType);
  return data as Prisma.VenueTemplateUpdateInput;
}

function templatePlanNeedsUpdate(input: TemplateUpdateInput) {
  return TEMPLATE_PLAN_KEYS.some((key) => input[key] !== undefined);
}

async function syncTemplateFloorPlan(
  tx: Prisma.TransactionClient,
  floorPlanId: string,
  input: TemplateUpdateInput,
) {
  await tx.floorPlan.update({
    where: { id: floorPlanId },
    data: floorPlanScalarPatch(input),
  });
  if (input.objects !== undefined) {
    await replaceFloorPlanObjects(tx, floorPlanId, input.objects);
  }
}

type TemplateWithPlan = PrismaVenueTemplate & {
  floorPlan?: (PrismaFloorPlan & { objectRows?: PrismaFloorPlanObject[] }) | null;
};

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  private mapTemplate(row: TemplateWithPlan): VenueTemplate {
    const plan = row.floorPlan;
    const objects =
      plan?.objectRows?.length
        ? plan.objectRows.map((object) => object.objectData as unknown as CanvasObject)
        : asArray<CanvasObject>(plan?.objects);

    return {
      id: row.id,
      ownerId: row.ownerId,
      name: row.name,
      description: row.description,
      venue: row.venue,
      venueRules: row.venueRules,
      permanentFeatures: asArray<CanvasObject>(row.permanentFeatures),
      floorPlanId: row.floorPlanId,
      width: plan?.width ?? 0,
      height: plan?.height ?? 0,
      gridSize: plan?.gridSize ?? 1,
      pax: row.pax,
      objects,
      includeGuests: row.includeGuests,
      includeSuppliers: row.includeSuppliers,
      guests: asArray<JsonValue>(row.guests),
      suppliers: asArray<JsonValue>(row.suppliers),
      sourceType: row.sourceType,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async listTemplates(): Promise<VenueTemplate[]> {
    const rows = await this.prisma.venueTemplate.findMany({
      orderBy: { createdAt: 'desc' },
      take: TEMPLATE_LIST_LIMIT,
      include: {
        floorPlan: {
          include: {
            objectRows: { orderBy: [{ zIndex: 'asc' }, { objectId: 'asc' }] },
          },
        },
      },
    });

    return rows.map((row) => this.mapTemplate(row));
  }

  async getTemplate(templateId: string): Promise<VenueTemplate> {
    const row = await this.prisma.venueTemplate.findUnique({
      where: { id: templateId },
      include: {
        floorPlan: {
          include: {
            objectRows: { orderBy: [{ zIndex: 'asc' }, { objectId: 'asc' }] },
          },
        },
      },
    });

    if (!row) throw new NotFoundException('Template not found');

    return this.mapTemplate(row);
  }

  async createTemplate(input: {
    name: string;
    description?: string;
    venue?: string;
    venueRules?: string;
    permanentFeatures?: CanvasObject[];
    objects?: CanvasObject[];
    width?: number;
    height?: number;
    gridSize?: number;
    pax?: number;
    includeGuests?: boolean;
    includeSuppliers?: boolean;
    guests?: unknown[];
    suppliers?: unknown[];
    sourceType?: string;
  }): Promise<VenueTemplate> {
    const planId = randomUUID();
    const templateId = randomUUID();
    const objects = input.objects ?? [];
    const gridSize = input.gridSize ?? 1;

    const template = await this.prisma.$transaction(async (tx) => {
      await tx.floorPlan.create({
        data: {
          id: planId,
          name: `${input.name} Base Layout`,
          venue: input.venue ?? '',
          ownerId: DEFAULT_OWNER_ID,
          templateId,
          width: input.width ?? 30,
          height: input.height ?? 20,
          gridSize,
          pax: input.pax ?? 0,
          objects: toPrismaJson(objects),
          guests: toPrismaJson(input.guests ?? []),
          suppliers: toPrismaJson(input.suppliers ?? []),
          seatCategories: toPrismaJson(defaultSeatCategories()),
        },
      });

      if (objects.length > 0) {
        await tx.floorPlanObject.createMany({
          data: objects.map((object, index) => ({
            floorPlanId: planId,
            objectId: object.id,
            kind: object.kind,
            zIndex: object.zIndex ?? index,
            objectData: toPrismaJson(object),
            svgMarkup: object.svgMarkup ?? null,
          })),
        });
      }

      return tx.venueTemplate.create({
        data: {
          id: templateId,
          ownerId: DEFAULT_OWNER_ID,
          name: input.name,
          description: input.description ?? '',
          venue: input.venue ?? '',
          venueRules: input.venueRules ?? '',
          permanentFeatures: toPrismaJson(input.permanentFeatures ?? []),
          floorPlanId: planId,
          pax: input.pax ?? 0,
          includeGuests: input.includeGuests ?? false,
          includeSuppliers: input.includeSuppliers ?? false,
          guests: toPrismaJson(input.guests ?? []),
          suppliers: toPrismaJson(input.suppliers ?? []),
          sourceType: input.sourceType ?? 'custom',
        },
        include: {
          floorPlan: {
            include: {
              objectRows: { orderBy: [{ zIndex: 'asc' }, { objectId: 'asc' }] },
            },
          },
        },
      });
    });

    return this.mapTemplate(template);
  }

  async updateTemplate(templateId: string, input: TemplateUpdateInput): Promise<VenueTemplate> {
    const row = await this.prisma.venueTemplate
      .update({
        where: { id: templateId },
        data: templateRowPatch(input),
        include: {
          floorPlan: {
            include: {
              objectRows: { orderBy: [{ zIndex: 'asc' }, { objectId: 'asc' }] },
            },
          },
        },
      })
      .catch(() => {
        throw new NotFoundException('Template not found');
      });

    if (templatePlanNeedsUpdate(input)) {
      await this.prisma.$transaction((tx) => syncTemplateFloorPlan(tx, row.floorPlanId, input));
      return this.getTemplate(templateId);
    }

    return this.mapTemplate(row);
  }

  async deleteTemplate(templateId: string): Promise<VenueTemplate> {
    const row = await this.prisma.venueTemplate
      .delete({
        where: { id: templateId },
      })
      .catch(() => {
        throw new NotFoundException('Template not found');
      });

    return this.mapTemplate(row);
  }
}
