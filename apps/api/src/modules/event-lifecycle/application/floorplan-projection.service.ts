import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import type {
  FloorplanEventProjection,
  FloorplanProjectionInput,
  FloorplanProjectionResult,
  FloorplanProjectionWriter,
} from '../contracts/floorplan-projection.port';

type ProjectionEvent = {
  floorPlanProjectionVersion: number;
} & Partial<Record<keyof FloorplanEventProjection, string | Date | null>>;

function isSameValue(current: unknown, incoming: unknown) {
  if (current instanceof Date && incoming instanceof Date) return current.getTime() === incoming.getTime();
  return current === incoming;
}

function projectionMatches(current: ProjectionEvent, state: FloorplanEventProjection) {
  return Object.entries(state).every(([key, value]) =>
    isSameValue(current[key as keyof FloorplanEventProjection], value),
  );
}

@Injectable()
export class FloorplanProjectionService implements FloorplanProjectionWriter {
  async project(
    input: FloorplanProjectionInput,
    transaction: PrismTransactionContext,
  ): Promise<FloorplanProjectionResult> {
    if (!Number.isInteger(input.version) || input.version < 1) {
      throw new BadRequestException('Floorplan projection version must be a positive integer');
    }
    if (Object.keys(input.state).length === 0) {
      throw new BadRequestException('Floorplan projection state cannot be empty');
    }

    const prisma = transaction.prisma;
    const updated = await prisma.opsEvent.updateMany({
      where: { id: input.eventId, floorPlanProjectionVersion: { lt: input.version } },
      data: { ...input.state, floorPlanProjectionVersion: input.version } as Prisma.OpsEventUpdateManyMutationInput,
    });
    if (updated.count === 1) return { applied: true, version: input.version };

    const current = await prisma.opsEvent.findUnique({ where: { id: input.eventId } }) as ProjectionEvent | null;
    if (!current) throw new NotFoundException('Event not found');
    if (current.floorPlanProjectionVersion === input.version && projectionMatches(current, input.state)) {
      return { applied: false, version: input.version };
    }
    throw new ConflictException('Stale floorplan projection version');
  }
}
