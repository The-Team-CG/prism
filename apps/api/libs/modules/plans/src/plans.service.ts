import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { FloorPlan as PrismaFloorPlan, FloorPlanObject as PrismaFloorPlanObject } from '@prisma/client';
import { PrismaService, toPrismaJson } from '@prism/database';
import { asArray } from '@prism/shared';
import type { CanvasObject, FloorPlan, Seat, SeatCategory } from '@prism/shared';
import { DEFAULT_OWNER_ID, defaultSeatCategories } from '@prism/shared';

type UpdatePlanChanges = {
  width?: number;
  height?: number;
  gridSize?: number;
  objects?: CanvasObject[];
  seats?: Seat[];
  seatCategories?: SeatCategory[];
};

type PlanActor = {
  actorRole?: string;
  role?: string;
  actorName?: string;
  actorEmail?: string;
  clientName?: string;
};

type PlanWithObjects = PrismaFloorPlan & { objectRows?: PrismaFloorPlanObject[] };

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  private mapPlan(row: PlanWithObjects, resolvedObjects?: CanvasObject[]): FloorPlan {
    const objects =
      resolvedObjects ??
      (row.objectRows?.length
        ? row.objectRows.map((r) => r.objectData as unknown as CanvasObject)
        : asArray<CanvasObject>(row.objects));

    return {
      id: row.id,
      name: row.name,
      width: row.width,
      height: row.height,
      gridSize: row.gridSize,
      ownerId: row.ownerId,
      templateId: row.templateId,
      eventId: row.eventId,
      objects,
      seats: asArray<Seat>(row.seats),
      seatCategories: asArray<SeatCategory>(row.seatCategories),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async getPlan(planId: string, _actor: PlanActor = {}): Promise<FloorPlan> {
    const row = await this.prisma.floorPlan.upsert({
      where: { id: planId },
      create: {
        id: planId,
        name: 'New Floor Plan',
        ownerId: DEFAULT_OWNER_ID,
        seatCategories: toPrismaJson(defaultSeatCategories()),
      },
      update: {},
      include: {
        objectRows: { orderBy: [{ zIndex: 'asc' }, { objectId: 'asc' }] },
      },
    });

    return this.mapPlan(row);
  }

  async updatePlan(planId: string, changes: UpdatePlanChanges, actor: PlanActor = {}): Promise<FloorPlan> {
    await this.assertCanUpdatePlan(planId, actor);

    if (Object.keys(changes).length === 0) {
      return this.getPlan(planId);
    }

    const { objects, ...scalarChanges } = changes;

    if (objects === undefined) {
      const row = await this.prisma.floorPlan
        .update({
          where: { id: planId },
          data: {
            ...(scalarChanges.width !== undefined && { width: scalarChanges.width }),
            ...(scalarChanges.height !== undefined && { height: scalarChanges.height }),
            ...(scalarChanges.gridSize !== undefined && { gridSize: scalarChanges.gridSize }),
            ...(scalarChanges.seats !== undefined && { seats: toPrismaJson(scalarChanges.seats) }),
            ...(scalarChanges.seatCategories !== undefined && {
              seatCategories: toPrismaJson(scalarChanges.seatCategories),
            }),
          },
          include: {
            objectRows: { orderBy: [{ zIndex: 'asc' }, { objectId: 'asc' }] },
          },
        })
        .catch(() => {
          throw new NotFoundException('Plan not found');
        });

      return this.mapPlan(row);
    }

    const typedObjects = objects ?? [];

    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.floorPlan
        .update({
          where: { id: planId },
          data: {
            ...(scalarChanges.width !== undefined && { width: scalarChanges.width }),
            ...(scalarChanges.height !== undefined && { height: scalarChanges.height }),
            ...(scalarChanges.gridSize !== undefined && { gridSize: scalarChanges.gridSize }),
            ...(scalarChanges.seats !== undefined && { seats: toPrismaJson(scalarChanges.seats) }),
            ...(scalarChanges.seatCategories !== undefined && {
              seatCategories: toPrismaJson(scalarChanges.seatCategories),
            }),
            objects: toPrismaJson(typedObjects),
          },
        })
        .catch(() => {
          throw new NotFoundException('Plan not found');
        });

      await tx.floorPlanObject.deleteMany({ where: { floorPlanId: planId } });

      if (typedObjects.length > 0) {
        await tx.floorPlanObject.createMany({
          data: typedObjects.map((obj, index) => ({
            floorPlanId: planId,
            objectId: obj.id,
            kind: obj.kind,
            zIndex: obj.zIndex ?? index,
            objectData: toPrismaJson(obj),
            svgMarkup: obj.svgMarkup ?? null,
          })),
        });
      }

      return updated;
    });

    return this.mapPlan(row, typedObjects);
  }

  private async assertCanUpdatePlan(planId: string, actor: PlanActor) {
    const role = (actor.actorRole ?? actor.role ?? 'pmcm-admin').trim().toLowerCase();
    if (role !== 'client') return;

    const plan = (await this.prisma.floorPlan.findUnique({
      where: { id: planId },
      include: { opsDraft: { include: { event: true } } },
    } as any)) as any;
    const draft = plan?.opsDraft;
    if (!draft) {
      throw new ForbiddenException('Clients cannot edit this floorplan');
    }
    if (draft.status === 'approved') {
      throw new ForbiddenException('Approved floorplans are read-only');
    }

    const actorClientName = (actor.clientName ?? actor.actorName ?? '').trim().toLowerCase();
    const eventClientName = (draft.event?.clientName ?? '').trim().toLowerCase();
    const portalUnlocked = draft.event?.clientPortalStatus === 'unlocked';

    if (!portalUnlocked || !actorClientName || actorClientName !== eventClientName) {
      throw new ForbiddenException('Clients cannot edit this event floorplan');
    }
  }
}
