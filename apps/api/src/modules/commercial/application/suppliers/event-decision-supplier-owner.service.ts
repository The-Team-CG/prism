import { Injectable } from '@nestjs/common';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import type { EventDecisionSupplierImpact, EventDecisionSupplierOwner } from '../../contracts/event-decision-supplier-owner.port';

@Injectable()
export class EventDecisionSupplierOwnerService implements EventDecisionSupplierOwner {

  async findEventDecisionSupplierImpact(eventId: string, transaction: PrismTransactionContext): Promise<EventDecisionSupplierImpact[]> {
    const rows = await transaction.prisma.opsSupplierQuoteRequest.findMany({
      where: { eventId, assignmentStatus: { not: 'withdrawn' } },
      select: { id: true, supplierName: true, assignmentStatus: true, supplier: { select: { email: true } } },
    });
    return rows.map(({ supplier, ...row }) => ({ ...row, supplierEmail: supplier?.email ?? null }));
  }

  async releaseEventSupplierObligations(eventId: string, transaction: PrismTransactionContext) {
    const result = await transaction.prisma.opsSupplierQuoteRequest.updateMany({
      where: { eventId, assignmentStatus: { not: 'withdrawn' } },
      data: { assignmentStatus: 'withdrawn', accessTokenRevokedAt: new Date() },
    });
    return result.count;
  }
}
