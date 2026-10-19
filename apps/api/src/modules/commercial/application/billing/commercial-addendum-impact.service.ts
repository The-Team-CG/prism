import { BadRequestException, Injectable } from '@nestjs/common';
import { toPrismaJson } from '@prism/kernel/database';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import type {
  ApplyCommercialAddendumInput,
  CommercialAddendumImpact,
  CommercialAddendumImpactWriter,
  CommercialAddendumPreflightInput,
  ExecutedAddendumConformeReference,
} from '../../contracts/addendum-impact-writer.port';

const SHA256_HEX = /^[a-f0-9]{64}$/;

function assertExecutedConforme(reference: ExecutedAddendumConformeReference | undefined) {
  if (!reference?.executionId?.trim() || !SHA256_HEX.test(reference.documentSha256 ?? '') || !(reference.documentVersion > 0)) {
    throw new BadRequestException('Addendum billing impact requires a fully executed addendum conforme');
  }
}

@Injectable()
export class CommercialAddendumImpactService implements CommercialAddendumImpactWriter {
  async assertApplicable(input: CommercialAddendumPreflightInput, transaction: PrismTransactionContext): Promise<void> {
    if (input.financialDelta === 0) return;
    const source = await transaction.prisma.opsBillingSource.findFirst({ where: { eventId: input.eventId, status: 'approved' }, select: { id: true } });
    if (!source) throw new BadRequestException('An approved billing source is required before applying a financial addendum');
  }

  async apply(input: ApplyCommercialAddendumInput, transaction: PrismTransactionContext): Promise<CommercialAddendumImpact[]> {
    assertExecutedConforme(input.executedConforme);
    const prisma = transaction.prisma;
    const impacts: CommercialAddendumImpact[] = [];
    const trace = { addendumConformeExecutionId: input.executedConforme.executionId, addendumDocumentSha256: input.executedConforme.documentSha256 };

    if (input.financialDelta !== 0) {
      const source = await prisma.opsBillingSource.findFirst({
        where: { eventId: input.eventId, status: 'approved' },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      });
      if (!source) throw new BadRequestException('An approved billing source is required before applying a financial addendum');
      const items = Array.isArray(source.lineItems) ? [...source.lineItems as unknown[]] : [];
      items.push({ label: `Addendum v${input.versionNumber} scope change`, amount: input.financialDelta, ...trace });
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
}
