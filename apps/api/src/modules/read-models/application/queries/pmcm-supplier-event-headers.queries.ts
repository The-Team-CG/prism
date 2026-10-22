import { Injectable } from '@nestjs/common';
import { PrismaService } from '@prism/kernel/database';

@Injectable()
export class PmcmSupplierEventHeadersQueries {
  constructor(private readonly prisma: PrismaService) {}

  forEvents(eventIds: string[]) {
    if (eventIds.length === 0) return Promise.resolve([]);
    // Query budget: one event-header lookup for the supplier facts page, bounded by its maximum size of 50.
    return this.prisma.opsEvent.findMany({
      where: { id: { in: eventIds } },
      select: { id: true, eventName: true, eventDate: true, status: true, actualEndedAt: true },
      orderBy: [{ id: 'asc' }],
      take: Math.min(eventIds.length, 50),
    });
  }
}
