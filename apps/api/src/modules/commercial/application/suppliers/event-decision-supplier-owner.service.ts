import { Injectable } from '@nestjs/common';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import type { EventDecisionSupplierImpact, EventDecisionSupplierOwner } from '../../contracts/event-decision-supplier-owner.port';

@Injectable()
export class EventDecisionSupplierOwnerService implements EventDecisionSupplierOwner {
  findEventDecisionSupplierImpact(eventId: string, transaction: PrismTransactionContext): Promise<EventDecisionSupplierImpact[]> {
    return transaction.prisma.opsSupplierQuoteRequest.findMany({
      where: { eventId, assignmentStatus: { not: 'withdrawn' } },
      select: { id: true, supplierName: true, assignmentStatus: true },
    });
  }

  async releaseEventSupplierObligations(eventId: string, transaction: PrismTransactionContext) {
    const result = await transaction.prisma.opsSupplierQuoteRequest.updateMany({
      where: { eventId, assignmentStatus: { not: 'withdrawn' } },
      data: { assignmentStatus: 'withdrawn' },
    });
    return result.count;
  }
}
