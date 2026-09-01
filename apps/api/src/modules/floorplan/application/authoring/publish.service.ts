import { Injectable, NotFoundException } from '@nestjs/common';
import type { FloorPlan as PrismaFloorPlan } from '@prisma/client';
import { PrismaService, toPrismaJson } from '@prism/kernel/database';
import { asArray } from '@prism/kernel/shared';
import type { CanvasObject, FloorPlan, JsonValue, PublishedSnapshot, Seat, SeatCategory } from '@prism/kernel/shared';
import { randomUUID } from 'node:crypto';

@Injectable()
export class PublishService {
  constructor(private readonly prisma: PrismaService) {}

  private mapPlan(row: PrismaFloorPlan): FloorPlan {
    return {
      id: row.id,
      name: row.name,
      venue: row.venue,
      width: row.width,
      height: row.height,
      gridSize: row.gridSize,
      pax: row.pax,
      ownerId: row.ownerId,
      templateId: row.templateId,
      eventId: row.eventId,
      objects: asArray<CanvasObject>(row.objects),
      guests: asArray<JsonValue>(row.guests),
      suppliers: asArray<JsonValue>(row.suppliers),
      seats: asArray<Seat>(row.seats),
      seatCategories: asArray<SeatCategory>(row.seatCategories),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async publishEvent(eventId: string): Promise<PublishedSnapshot> {
    const event = await this.prisma.eventInstance.findUnique({
      where: { id: eventId },
      include: { floorPlan: true },
    });

    if (!event) throw new NotFoundException('Event not found');

    const mappedPlan = this.mapPlan(event.floorPlan);
    const slug = `event-${event.id.slice(0, 8)}`;

    const snapshot = await this.prisma.$transaction(async (tx) => {
      await tx.eventInstance.update({
        where: { id: eventId },
        data: { status: 'published' },
      });

      return tx.publishedSnapshot.upsert({
        where: { eventId },
        create: {
          id: randomUUID(),
          slug,
          eventId,
          floorPlan: toPrismaJson(mappedPlan),
        },
        update: {
          slug,
          floorPlan: toPrismaJson(mappedPlan),
          publishedAt: new Date(),
        },
      });
    });

    return {
      id: snapshot.id,
      slug: snapshot.slug,
      eventId: snapshot.eventId,
      floorPlan: snapshot.floorPlan as unknown as FloorPlan,
      publishedAt: snapshot.publishedAt.toISOString(),
    };
  }

  async getPublishedLayout(slug: string): Promise<PublishedSnapshot> {
    const snapshot = await this.prisma.publishedSnapshot.findUnique({
      where: { slug },
    });

    if (!snapshot) throw new NotFoundException('Published layout not found');

    return {
      id: snapshot.id,
      slug: snapshot.slug,
      eventId: snapshot.eventId,
      floorPlan: snapshot.floorPlan as unknown as FloorPlan,
      publishedAt: snapshot.publishedAt.toISOString(),
    };
  }
}
