import { BadRequestException, Injectable } from '@nestjs/common';
import { toPrismaJson } from '@prism/kernel/database';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import type {
  ApplyCommercialAddendumInput,
  CommercialAddendumImpact,
  CommercialAddendumImpactWriter,
} from '../../contracts/addendum-impact-writer.port';

@Injectable()
export class CommercialAddendumImpactService implements CommercialAddendumImpactWriter {
  async apply(input: ApplyCommercialAddendumInput, transaction: PrismTransactionContext): Promise<CommercialAddendumImpact[]> {
    const prisma = transaction.prisma;
    const impacts: CommercialAddendumImpact[] = [];

    if (input.financialDelta !== 0) {
      const source = await prisma.opsBillingSource.findFirst({
        where: { eventId: input.eventId, status: 'approved' },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      });
      if (!source) throw new BadRequestException('An approved billing source is required before applying a financial addendum');
      const items = Array.isArray(source.lineItems) ? [...source.lineItems as unknown[]] : [];
      items.push({ label: `Addendum v${input.versionNumber} scope change`, amount: input.financialDelta });
      const updated = await prisma.opsBillingSource.update({
        where: { id: source.id },
        data: { totalAmount: source.totalAmount + input.financialDelta, lineItems: toPrismaJson(items) },
      });
      impacts.push({
        targetType: 'billing_source',
        targetId: source.id,
        beforeValue: { totalAmount: source.totalAmount, lineItems: source.lineItems as unknown },
        afterValue: { totalAmount: updated.totalAmount, lineItems: updated.lineItems as unknown },
        deltaAmount: input.financialDelta,
      });
    }

    for (const change of input.quotePriceChanges) {
      const quote = await prisma.opsSupplierQuote.findFirst({
        where: { id: change.quoteId, eventId: input.eventId, status: 'selected' },
      });
      if (!quote || quote.amount === change.amount) continue;
      const updated = await prisma.opsSupplierQuote.update({ where: { id: quote.id }, data: { amount: change.amount } });
      impacts.push({
        targetType: 'supplier_quote',
        targetId: quote.id,
        beforeValue: { amount: quote.amount, status: quote.status },
        afterValue: { amount: updated.amount, status: updated.status },
        deltaAmount: updated.amount - quote.amount,
      });
    }

    return impacts;
  }
}
