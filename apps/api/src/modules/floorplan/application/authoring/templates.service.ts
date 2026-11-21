import { Injectable, NotFoundException } from '@nestjs/common';
import type { FloorPlan as PrismaFloorPlan, Prisma, VenueTemplate as PrismaVenueTemplate } from '@prisma/client';
import { PrismaService } from '@prism/kernel/database';
import { randomUUID } from 'node:crypto';
import type { VenueTemplate } from '@prism/kernel/shared';
import { roomSize, withoutEventAssignments } from '@prism/floorplan-scene';
import type { CreateTemplateInput, FloorplanSceneDocument, UpdateTemplateInput } from '@prism/types';
import { floorPlanScalarPatch, setIfDefined } from './plan-patch';
import { acceptedScene, sceneColumns, storedScene } from '../stored-scene';

const TEMPLATE_LIST_LIMIT = 100;

/** A template's room is measured from its scene's walls, so the plan's size and the scene can never disagree. */
function sceneDimensions(scene: FloorplanSceneDocument) {
  const room = roomSize(scene);
  return { width: Math.round(room?.width ?? 0), height: Math.round(room?.depth ?? 0) };
}

function templateRowPatch(input: UpdateTemplateInput): Prisma.VenueTemplateUpdateInput {
  const data: Record<string, unknown> = {};
  setIfDefined(data, 'name', input.name);
  setIfDefined(data, 'description', input.description);
  setIfDefined(data, 'venue', input.venue);
  setIfDefined(data, 'venueRules', input.venueRules);
  setIfDefined(data, 'pax', input.pax);
  setIfDefined(data, 'sourceType', input.sourceType);
  return data as Prisma.VenueTemplateUpdateInput;
}

type TemplateWithPlan = PrismaVenueTemplate & { floorPlan: PrismaFloorPlan };

const PLAN_INCLUDE = { floorPlan: true } as const;

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  private mapTemplate(row: TemplateWithPlan): VenueTemplate {
    const plan = row.floorPlan;
    return {
      id: row.id,
      ownerId: row.ownerId,
      name: row.name,
      description: row.description,
      venue: row.venue,
      venueRules: row.venueRules,
      floorPlanId: row.floorPlanId,
      width: plan.width,
      height: plan.height,
      gridSize: plan.gridSize,
      pax: row.pax,
      scene: storedScene(plan),
      sourceType: row.sourceType,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async listTemplates(): Promise<VenueTemplate[]> {
    const rows = await this.prisma.venueTemplate.findMany({
      orderBy: { createdAt: 'desc' },
      take: TEMPLATE_LIST_LIMIT,
      include: PLAN_INCLUDE,
    });

    return rows.map((row) => this.mapTemplate(row));
  }

  async getTemplate(templateId: string): Promise<VenueTemplate> {
    const row = await this.prisma.venueTemplate.findUnique({
      where: { id: templateId },
      include: PLAN_INCLUDE,
    });

    if (!row) throw new NotFoundException('Template not found');

    return this.mapTemplate(row);
  }

  async createTemplate(input: CreateTemplateInput, actorId: string): Promise<VenueTemplate> {
    const planId = randomUUID();
    const templateId = randomUUID();
    // A template is the venue's layout: the guests and suppliers of the event it was saved from stay with that event.
    const scene = withoutEventAssignments(acceptedScene(input.scene));
    const { width, height } = sceneDimensions(scene);

    const template = await this.prisma.$transaction(async (tx) => {
      await tx.floorPlan.create({
        data: {
          id: planId,
          name: `${input.name} Base Layout`,
          venue: input.venue ?? '',
          ownerId: actorId,
          templateId,
          width,
          height,
          gridSize: 1,
          pax: input.pax ?? 0,
          ...sceneColumns(scene),
        },
      });

      return tx.venueTemplate.create({
        data: {
          id: templateId,
          ownerId: actorId,
          name: input.name,
          description: input.description ?? '',
          venue: input.venue ?? '',
          venueRules: input.venueRules ?? '',
          floorPlanId: planId,
          pax: input.pax ?? 0,
          sourceType: input.sourceType ?? 'custom',
        },
        include: PLAN_INCLUDE,
      });
    });

    return this.mapTemplate(template);
  }

  async updateTemplate(templateId: string, input: UpdateTemplateInput): Promise<VenueTemplate> {
    const row = await this.prisma.venueTemplate
      .update({
        where: { id: templateId },
        data: templateRowPatch(input),
        include: PLAN_INCLUDE,
      })
      .catch(() => {
        throw new NotFoundException('Template not found');
      });

    if (input.scene !== undefined) {
      const scene = withoutEventAssignments(acceptedScene(input.scene));
      const { width, height } = sceneDimensions(scene);
      await this.prisma.floorPlan.update({
        where: { id: row.floorPlanId },
        data: floorPlanScalarPatch({ scene, width, height }),
      });
      return this.getTemplate(templateId);
    }

    return this.mapTemplate(row);
  }

  async deleteTemplate(templateId: string): Promise<VenueTemplate> {
    const row = await this.prisma.venueTemplate
      .delete({
        where: { id: templateId },
        include: PLAN_INCLUDE,
      })
      .catch(() => {
        throw new NotFoundException('Template not found');
      });

    return this.mapTemplate(row);
  }
}
