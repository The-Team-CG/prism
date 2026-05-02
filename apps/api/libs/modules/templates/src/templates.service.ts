import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService, toPrismaJson } from '@prism/database';
import { asArray } from '@prism/shared';
import type { CanvasObject, VenueTemplate } from '@prism/shared';
import { randomUUID } from 'node:crypto';
import { DEFAULT_OWNER_ID, defaultSeatCategories } from '@prism/shared';

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async listTemplates(): Promise<VenueTemplate[]> {
    const rows = await this.prisma.venueTemplate.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((row) => ({
      id: row.id,
      ownerId: row.ownerId,
      name: row.name,
      description: row.description,
      venueRules: row.venueRules,
      permanentFeatures: asArray<CanvasObject>(row.permanentFeatures),
      floorPlanId: row.floorPlanId,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async getTemplate(templateId: string): Promise<VenueTemplate> {
    const row = await this.prisma.venueTemplate.findUnique({
      where: { id: templateId },
    });

    if (!row) throw new NotFoundException('Template not found');

    return {
      id: row.id,
      ownerId: row.ownerId,
      name: row.name,
      description: row.description,
      venueRules: row.venueRules,
      permanentFeatures: asArray<CanvasObject>(row.permanentFeatures),
      floorPlanId: row.floorPlanId,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async createTemplate(input: {
    name: string;
    description?: string;
    venueRules?: string;
    permanentFeatures?: CanvasObject[];
    objects?: CanvasObject[];
  }): Promise<VenueTemplate> {
    const planId = randomUUID();
    const templateId = randomUUID();

    const template = await this.prisma.$transaction(async (tx) => {
      await tx.floorPlan.create({
        data: {
          id: planId,
          name: `${input.name} Base Layout`,
          ownerId: DEFAULT_OWNER_ID,
          templateId,
          objects: toPrismaJson(input.objects ?? []),
          seatCategories: toPrismaJson(defaultSeatCategories()),
        },
      });

      return tx.venueTemplate.create({
        data: {
          id: templateId,
          ownerId: DEFAULT_OWNER_ID,
          name: input.name,
          description: input.description ?? '',
          venueRules: input.venueRules ?? '',
          permanentFeatures: toPrismaJson(input.permanentFeatures ?? []),
          floorPlanId: planId,
        },
      });
    });

    return {
      id: template.id,
      ownerId: template.ownerId,
      name: template.name,
      description: template.description,
      venueRules: template.venueRules,
      permanentFeatures: asArray<CanvasObject>(template.permanentFeatures),
      floorPlanId: template.floorPlanId,
      createdAt: template.createdAt.toISOString(),
    };
  }

  async updateTemplate(
    templateId: string,
    input: {
      name?: string;
      description?: string;
      venueRules?: string;
      permanentFeatures?: CanvasObject[];
    },
  ): Promise<VenueTemplate> {
    const row = await this.prisma.venueTemplate
      .update({
        where: { id: templateId },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.venueRules !== undefined && { venueRules: input.venueRules }),
          ...(input.permanentFeatures !== undefined && {
            permanentFeatures: toPrismaJson(input.permanentFeatures),
          }),
        },
      })
      .catch(() => {
        throw new NotFoundException('Template not found');
      });

    return {
      id: row.id,
      ownerId: row.ownerId,
      name: row.name,
      description: row.description,
      venueRules: row.venueRules,
      permanentFeatures: asArray<CanvasObject>(row.permanentFeatures),
      floorPlanId: row.floorPlanId,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
