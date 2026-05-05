import { Injectable, NotFoundException } from '@nestjs/common';
import type { FloorPlan as PrismaFloorPlan, FloorPlanObject as PrismaFloorPlanObject, VenueTemplate as PrismaVenueTemplate } from '@prisma/client';
import { PrismaService, toPrismaJson } from '@prism/database';
import { asArray } from '@prism/shared';
import type { CanvasObject, JsonValue, VenueTemplate } from '@prism/shared';
import { randomUUID } from 'node:crypto';
import { DEFAULT_OWNER_ID, defaultSeatCategories } from '@prism/shared';

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

  async updateTemplate(
    templateId: string,
    input: {
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
    },
  ): Promise<VenueTemplate> {
    const row = await this.prisma.venueTemplate
      .update({
        where: { id: templateId },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.venue !== undefined && { venue: input.venue }),
          ...(input.venueRules !== undefined && { venueRules: input.venueRules }),
          ...(input.permanentFeatures !== undefined && {
            permanentFeatures: toPrismaJson(input.permanentFeatures),
          }),
          ...(input.pax !== undefined && { pax: input.pax }),
          ...(input.includeGuests !== undefined && { includeGuests: input.includeGuests }),
          ...(input.includeSuppliers !== undefined && { includeSuppliers: input.includeSuppliers }),
          ...(input.guests !== undefined && { guests: toPrismaJson(input.guests) }),
          ...(input.suppliers !== undefined && { suppliers: toPrismaJson(input.suppliers) }),
          ...(input.sourceType !== undefined && { sourceType: input.sourceType }),
        },
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

    if (
      input.objects !== undefined ||
      input.width !== undefined ||
      input.height !== undefined ||
      input.gridSize !== undefined ||
      input.venue !== undefined ||
      input.pax !== undefined ||
      input.guests !== undefined ||
      input.suppliers !== undefined
    ) {
      await this.prisma.$transaction(async (tx) => {
        await tx.floorPlan.update({
          where: { id: row.floorPlanId },
          data: {
            ...(input.width !== undefined && { width: input.width }),
            ...(input.height !== undefined && { height: input.height }),
            ...(input.gridSize !== undefined && { gridSize: input.gridSize }),
            ...(input.venue !== undefined && { venue: input.venue }),
            ...(input.pax !== undefined && { pax: input.pax }),
            ...(input.guests !== undefined && { guests: toPrismaJson(input.guests) }),
            ...(input.suppliers !== undefined && { suppliers: toPrismaJson(input.suppliers) }),
            ...(input.objects !== undefined && { objects: toPrismaJson(input.objects) }),
          },
        });

        if (input.objects !== undefined) {
          await tx.floorPlanObject.deleteMany({ where: { floorPlanId: row.floorPlanId } });
          if (input.objects.length > 0) {
            await tx.floorPlanObject.createMany({
              data: input.objects.map((object, index) => ({
                floorPlanId: row.floorPlanId,
                objectId: object.id,
                kind: object.kind,
                zIndex: object.zIndex ?? index,
                objectData: toPrismaJson(object),
                svgMarkup: object.svgMarkup ?? null,
              })),
            });
          }
        }
      });

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
