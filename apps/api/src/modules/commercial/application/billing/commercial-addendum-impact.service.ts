import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { toPrismaJson } from '@prism/kernel/database';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import type {
  ApplyCommercialAddendumInput,
  CommercialAddendumConformeTrace,
  CommercialAddendumImpact,
  CommercialAddendumImpactWriter,
  RecordAddendumConformeInput,
} from '../../contracts/addendum-impact-writer.port';

function addendumLineLabel(versionNumber: number) {
  return `Addendum v${versionNumber} scope change`;
}

type StoredLineItem = { label?: unknown; addendumId?: unknown; addendumConforme?: unknown } & Record<string, unknown>;

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
      items.push({ label: addendumLineLabel(input.versionNumber), amount: input.financialDelta, addendumId: input.addendumId });
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

    // QUERY_AUDIT_ALLOW_BOUNDED_LOOP: each event-scoped quote has its own amount and before/after facts; owner eligibility, mutation, and projection stay in the caller's Serializable transaction.
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

  async recordConformeExecution(input: RecordAddendumConformeInput, transaction: PrismTransactionContext): Promise<CommercialAddendumConformeTrace | null> {
    const prisma = transaction.prisma;
    const source = await prisma.opsBillingSource.findFirst({ where: { id: input.billingSourceId, eventId: input.eventId } });
    if (!source) return null;
    const items = Array.isArray(source.lineItems) ? (source.lineItems as StoredLineItem[]) : [];
    const index = items.findIndex((item) => item?.addendumId === input.addendumId);
    if (index === -1) return null;

    const reference = {
      executionId: input.executionId,
      addendumId: input.addendumId,
      versionNumber: input.versionNumber,
      documentSha256: input.documentSha256,
      executedAt: input.executedAt,
    };
    const bound = items[index]?.addendumConforme as { executionId?: unknown } | undefined;
    if (bound?.executionId === input.executionId) return { billingSourceId: source.id };
    if (bound) throw new ConflictException('This addendum billing line is already bound to a different conforme execution');

    const updated = items.map((item, position) => (position === index ? { ...item, addendumConforme: reference } : item));
    await prisma.opsBillingSource.update({ where: { id: source.id }, data: { lineItems: toPrismaJson(updated) } });
    return { billingSourceId: source.id };
  }
}
