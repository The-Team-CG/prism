import { BadRequestException, ConflictException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { isDeepStrictEqual } from 'node:util';
import { toPrismaJson } from '@prism/kernel/database';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import type { AddendumPlannedImpacts } from '@prism/types';
import type {
  ApplyCommercialAddendumInput,
  CommercialAddendumConformeTrace,
  CommercialAddendumImpact,
  CommercialAddendumImpactWriter,
  PreviewCommercialAddendumInput,
  RecordAddendumConformeInput,
} from '../../contracts/addendum-impact-writer.port';

const STALE_PLAN_MESSAGE = 'Billing or a selected supplier quote changed after this addendum was issued. Withdraw the addendum and issue a new one.';

function addendumLineLabel(versionNumber: number) {
  return `Addendum v${versionNumber} scope change`;
}

type StoredLineItem = { label?: unknown; addendumId?: unknown; addendumConforme?: unknown } & Record<string, unknown>;

function lineItemsOf(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new InternalServerErrorException('Billing source line items are stored in an unexpected shape');
  return value as Record<string, unknown>[];
}

type CommercialPrisma = PrismTransactionContext['prisma'];
type BillingSourceRow = NonNullable<Awaited<ReturnType<CommercialPrisma['opsBillingSource']['findFirst']>>>;
type SupplierQuoteRow = NonNullable<Awaited<ReturnType<CommercialPrisma['opsSupplierQuote']['findFirst']>>>;

/** The approved billing source the plan names, if its totals and line items still match the issue-time baseline. */
async function verifiedBillingSource(prisma: CommercialPrisma, eventId: string, plan: AddendumPlannedImpacts['billing']): Promise<BillingSourceRow | null> {
  if (!plan) return null;
  const source = await prisma.opsBillingSource.findFirst({ where: { id: plan.billingSourceId, eventId, status: 'approved' } });
  if (!source || source.totalAmount !== plan.baselineTotalAmount || !isDeepStrictEqual(lineItemsOf(source.lineItems), plan.baselineLineItems)) {
    throw new ConflictException(STALE_PLAN_MESSAGE);
  }
  return source;
}

/** Each planned quote must still be selected in this event at its issue-time amount. */
async function verifiedSelectedQuotes(prisma: CommercialPrisma, eventId: string, changes: AddendumPlannedImpacts['quotes']): Promise<Array<{ quote: SupplierQuoteRow; targetAmount: number }>> {
  const verified: Array<{ quote: SupplierQuoteRow; targetAmount: number }> = [];
  // QUERY_AUDIT_ALLOW_BOUNDED_LOOP: each planned quote is one event-scoped row with its own baseline, checked inside the caller's Serializable transaction.
  for (const change of changes) {
    const quote = await prisma.opsSupplierQuote.findFirst({ where: { id: change.quoteId, eventId, status: 'selected' } });
    if (!quote || quote.amount !== change.baselineAmount) throw new ConflictException(STALE_PLAN_MESSAGE);
    verified.push({ quote, targetAmount: change.targetAmount });
  }
  return verified;
}

async function writeBillingImpact(prisma: CommercialPrisma, billing: BillingSourceRow, input: ApplyCommercialAddendumInput): Promise<CommercialAddendumImpact> {
  const delta = input.plan.financialDelta;
  const items = [...lineItemsOf(billing.lineItems), { label: addendumLineLabel(input.versionNumber), amount: delta, addendumId: input.addendumId }];
  const updated = await prisma.opsBillingSource.update({
    where: { id: billing.id },
    data: { totalAmount: billing.totalAmount + delta, lineItems: toPrismaJson(items) },
  });
  return {
    targetType: 'billing_source',
    targetId: billing.id,
    beforeValue: { totalAmount: billing.totalAmount, lineItems: billing.lineItems as unknown },
    afterValue: { totalAmount: updated.totalAmount, lineItems: updated.lineItems as unknown },
    deltaAmount: delta,
  };
}

async function writeQuoteImpact(prisma: CommercialPrisma, quote: SupplierQuoteRow, targetAmount: number): Promise<CommercialAddendumImpact> {
  const updated = await prisma.opsSupplierQuote.update({ where: { id: quote.id }, data: { amount: targetAmount } });
  return {
    targetType: 'supplier_quote',
    targetId: quote.id,
    beforeValue: { amount: quote.amount, status: quote.status },
    afterValue: { amount: updated.amount, status: updated.status },
    deltaAmount: updated.amount - quote.amount,
  };
}

@Injectable()
export class CommercialAddendumImpactService implements CommercialAddendumImpactWriter {
  async preview(input: PreviewCommercialAddendumInput, transaction: PrismTransactionContext): Promise<AddendumPlannedImpacts> {
    const prisma = transaction.prisma;
    let billing: AddendumPlannedImpacts['billing'] = null;

    if (input.financialDelta !== 0) {
      const source = await prisma.opsBillingSource.findFirst({
        where: { eventId: input.eventId, status: 'approved' },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      });
      if (!source) throw new BadRequestException('An approved billing source is required before applying a financial addendum');
      billing = { billingSourceId: source.id, baselineTotalAmount: source.totalAmount, baselineLineItems: lineItemsOf(source.lineItems) };
    }

    const quotes: AddendumPlannedImpacts['quotes'] = [];
    // QUERY_AUDIT_ALLOW_BOUNDED_LOOP: each event-scoped quote has its own baseline; the list is bounded by one addendum's quote comparison.
    for (const change of input.quotePriceChanges) {
      const quote = await prisma.opsSupplierQuote.findFirst({
        where: { id: change.quoteId, eventId: input.eventId, status: 'selected' },
      });
      if (!quote || quote.amount === change.amount) continue;
      quotes.push({ quoteId: quote.id, baselineAmount: quote.amount, targetAmount: change.amount });
    }

    return { financialDelta: input.financialDelta, billing, quotes };
  }

  async apply(input: ApplyCommercialAddendumInput, transaction: PrismTransactionContext): Promise<CommercialAddendumImpact[]> {
    const prisma = transaction.prisma;
    // Verify every baseline before the first write, so a stale plan changes nothing even outside a rolled-back transaction.
    const billing = await verifiedBillingSource(prisma, input.eventId, input.plan.billing);
    const quotes = await verifiedSelectedQuotes(prisma, input.eventId, input.plan.quotes);

    const impacts: CommercialAddendumImpact[] = [];
    if (billing) impacts.push(await writeBillingImpact(prisma, billing, input));
    for (const { quote, targetAmount } of quotes) impacts.push(await writeQuoteImpact(prisma, quote, targetAmount));
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
