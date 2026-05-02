import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService, toPrismaJson } from '@prism/database';
import { asArray } from '@prism/shared';
import type { CanvasObject, EventInstance, Seat, SeatCategory } from '@prism/shared';
import { randomUUID } from 'node:crypto';

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async listEvents(): Promise<EventInstance[]> {
    const rows = await this.prisma.eventInstance.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((row) => ({
      id: row.id,
      ownerId: row.ownerId,
      templateId: row.templateId,
      floorPlanId: row.floorPlanId,
      name: row.name,
      startsAt: row.startsAt.toISOString(),
      status: row.status as EventInstance['status'],
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async createEventFromTemplate(input: {
    templateId: string;
    name: string;
    startsAt: string;
  }): Promise<EventInstance> {
    const template = await this.prisma.venueTemplate.findUnique({
      where: { id: input.templateId },
      include: { floorPlan: true },
    });

    if (!template) throw new NotFoundException('Template not found');

    const eventId = randomUUID();
    const eventPlanId = randomUUID();

    const sourcePlan = template.floorPlan;
    const permanentFeatures = asArray<CanvasObject>(template.permanentFeatures);
    const baseObjects = asArray<CanvasObject>(sourcePlan.objects);
    const combinedObjects = [
      ...permanentFeatures.map((f) => ({ ...f, locked: true })),
      ...baseObjects,
    ];

    const sourceSeats = asArray<Seat>(sourcePlan.seats);
    const sourceSeatCategories = asArray<SeatCategory>(sourcePlan.seatCategories);

    const event = await this.prisma.$transaction(async (tx) => {
      await tx.floorPlan.create({
        data: {
          id: eventPlanId,
          name: `${input.name} Layout`,
          ownerId: template.ownerId,
          templateId: template.id,
          eventId,
          objects: toPrismaJson(combinedObjects),
          seats: toPrismaJson(sourceSeats),
          seatCategories: toPrismaJson(sourceSeatCategories),
        },
      });

      return tx.eventInstance.create({
        data: {
          id: eventId,
          ownerId: template.ownerId,
          templateId: template.id,
          floorPlanId: eventPlanId,
          name: input.name,
          startsAt: new Date(input.startsAt),
          status: 'draft',
        },
      });
    });

    return {
      id: event.id,
      ownerId: event.ownerId,
      templateId: event.templateId,
      floorPlanId: event.floorPlanId,
      name: event.name,
      startsAt: event.startsAt.toISOString(),
      status: event.status as EventInstance['status'],
      createdAt: event.createdAt.toISOString(),
    };
  }
}
