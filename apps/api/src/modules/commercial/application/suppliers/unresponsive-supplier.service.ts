import { Injectable } from '@nestjs/common';
import { PrismaService } from '@prism/kernel/database';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventAccessPolicyService, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { SUPPLIER_RESPONSE_WINDOW_HOURS, type PrismUnresponsiveSupplier } from '@prism/types';

type OpenRequest = { id: string; supplierId: string | null; supplierName: string; category: string; categoryId: string | null; createdAt: Date };

/** FR-76: quote requests still open after one response window, with Tier 2 suggestions only after the second window. */
export function unresponsiveSuppliersFrom(input: {
  eventName: string;
  now: Date;
  requests: OpenRequest[];
  phones: Map<string, string>;
  tier2ByCategory: Map<string, Array<{ supplierId: string; supplierName: string }>>;
}): PrismUnresponsiveSupplier[] {
  return input.requests.flatMap((request) => {
    const hoursWaiting = Math.floor((input.now.getTime() - request.createdAt.getTime()) / 3_600_000);
    if (hoursWaiting < SUPPLIER_RESPONSE_WINDOW_HOURS) return [];
    const window = hoursWaiting >= SUPPLIER_RESPONSE_WINDOW_HOURS * 2 ? 'second' : 'first';
    return [{
      requestId: request.id, supplierId: request.supplierId, supplierName: request.supplierName,
      supplierPhone: request.supplierId ? input.phones.get(request.supplierId) ?? '' : '', category: request.category, hoursWaiting, window,
      tier2Suggestions: window === 'second' && request.categoryId ? input.tier2ByCategory.get(request.categoryId) ?? [] : [],
      draftMessage: `Hi ${request.supplierName}, this is PMCM following up on our ${request.category} quote request for ${input.eventName}. Could you send your quote through the P.R.I.S.M link, or tell us if you cannot take it?`,
    }];
  });
}

@Injectable()
export class UnresponsiveSupplierService {
  constructor(private readonly prisma: PrismaService, private readonly access: EventAccessPolicyService) {}

  async list(eventId: string, actor: ResolvedEventOpsActor, now = new Date()): Promise<PrismUnresponsiveSupplier[]> {
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin], 'unresponsive suppliers', eventId);
    const event = await this.prisma.opsEvent.findUnique({ where: { id: eventId }, select: { eventName: true } });
    if (!event) return [];
    const requests = await this.prisma.opsSupplierQuoteRequest.findMany({
      where: { eventId, status: 'open', createdAt: { lte: new Date(now.getTime() - SUPPLIER_RESPONSE_WINDOW_HOURS * 3_600_000) } },
      select: { id: true, supplierId: true, supplierName: true, category: true, categoryId: true, createdAt: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 100,
    });
    if (requests.length === 0) return [];
    const supplierIds = requests.map((request) => request.supplierId).filter((id): id is string => Boolean(id));
    const categoryIds = [...new Set(requests.map((request) => request.categoryId).filter((id): id is string => Boolean(id)))];
    const requestedSupplierIds = await this.prisma.opsSupplierQuoteRequest.findMany({ where: { eventId, supplierId: { not: null } }, select: { supplierId: true }, take: 500 });
    const alreadyAsked = new Set(requestedSupplierIds.map((row) => row.supplierId));
    const [suppliers, tier2] = await Promise.all([
      this.prisma.opsSupplier.findMany({ where: { id: { in: supplierIds } }, select: { id: true, phone: true }, take: 100 }),
      this.prisma.opsSupplier.findMany({ where: { categoryId: { in: categoryIds }, tier: 'tier_2' }, select: { id: true, name: true, categoryId: true }, orderBy: { name: 'asc' }, take: 200 }),
    ]);
    const tier2ByCategory = new Map<string, Array<{ supplierId: string; supplierName: string }>>();
    for (const supplier of tier2.filter((candidate) => !alreadyAsked.has(candidate.id))) {
      tier2ByCategory.set(supplier.categoryId, [...(tier2ByCategory.get(supplier.categoryId) ?? []), { supplierId: supplier.id, supplierName: supplier.name }].slice(0, 3));
    }
    return unresponsiveSuppliersFrom({ eventName: event.eventName, now, requests, phones: new Map(suppliers.map((supplier) => [supplier.id, supplier.phone])), tier2ByCategory });
  }
}
