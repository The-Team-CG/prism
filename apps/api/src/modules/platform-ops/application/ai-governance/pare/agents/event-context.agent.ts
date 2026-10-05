import { PrismaService } from '@prism/kernel/database';
import type { Prisma } from '@prisma/client';
import type { PAREContext } from '../pare.types';
import { PareSourceNotFoundError } from '../pare-source.errors';

type PareRequestContext = {
  assignmentStatus?: string;
  supplierId: string | null;
  supplierName: string;
  category: string;
  supplier?: { tier: string } | null;
};
type PareEventContext = {
  id: string;
  eventDate: Date | string;
  eventName: string;
  clientName: string;
};
type PareQuoteSpend = Pick<Prisma.OpsSupplierQuoteGetPayload<{}>, 'amount' | 'requestId'>;

function assertWithdrawnSource(
  request: { assignmentStatus?: string },
  triggerId: string,
  required: boolean,
): void {
  if (required && request.assignmentStatus !== 'withdrawn') {
    throw new PareSourceNotFoundError(`PARE: quote request ${triggerId} is no longer withdrawn`);
  }
}

export class EventContextAgent {
  constructor(private readonly prisma: PrismaService) {}

  async buildPareEventContext(
    triggerId: string,
    prefetched?: { request: PareRequestContext; event: PareEventContext },
    requireWithdrawn = false,
    signal?: AbortSignal,
  ): Promise<PAREContext> {
    throwIfAborted(signal);
    let request: PareRequestContext;
    let event: PareEventContext;

    if (prefetched) {
      assertWithdrawnSource(prefetched.request, triggerId, requireWithdrawn);
      request = prefetched.request;
      event = prefetched.event;
    } else {
      const fetched = await this.prisma.opsSupplierQuoteRequest.findUnique({
        where: { id: triggerId },
        select: {
          assignmentStatus: true,
          supplierId: true,
          supplierName: true,
          category: true,
          supplier: { select: { tier: true } },
          event: { select: { id: true, eventDate: true, eventName: true, clientName: true } },
        },
      });
      if (!fetched) throw new PareSourceNotFoundError(`PARE: quote request ${triggerId} not found`);
      assertWithdrawnSource(fetched, triggerId, requireWithdrawn);
      request = fetched;
      event = fetched.event;
    }

    const eventDate = new Date(event.eventDate);
    const now = new Date();
    const daysUntilEvent = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    let allQuotes: PareQuoteSpend[] = [];
    let clientPreferences: string[] = [];

    const readSelectedQuotes = async () => {
      try {
        return await this.prisma.opsSupplierQuote.findMany({
          where: { eventId: event.id, status: 'selected' },
          select: { amount: true, requestId: true },
        });
      } catch { /* DB unavailable — proceed with empty quotes */ return []; }
    };
    const readLatestBriefing = async () => {
      try {
        throwIfAborted(signal);
        return await this.prisma.opsBriefing.findMany({
          where: { eventId: event.id },
          orderBy: { submittedAt: 'desc' },
          take: 1,
          select: { serviceRequirements: true },
        });
      } catch { /* DB unavailable — no preferences */ return []; }
    };
    const [quoteRows, briefings] = await Promise.all([readSelectedQuotes(), readLatestBriefing()]);
    allQuotes = quoteRows;
    throwIfAborted(signal);
    if (briefings.length > 0 && briefings[0].serviceRequirements) {
      const requirements = briefings[0].serviceRequirements;
      if (Array.isArray(requirements)) {
        requirements.forEach((value) => {
          if (typeof value === 'string' && value.trim()) clientPreferences.push(value);
        });
      } else if (typeof requirements === 'object' && requirements !== null) {
        Object.entries(requirements as Record<string, unknown>).forEach(([key, value]) => {
          if (value && typeof value !== 'object') clientPreferences.push(`${key}: ${value}`);
        });
      }
    }

    const spentBudget = allQuotes.reduce((sum, quote) => sum + (quote.amount ?? 0), 0);
    throwIfAborted(signal);
    const withdrawnQuote = allQuotes.find((quote) => quote.requestId === triggerId);
    const quotedAmount = withdrawnQuote?.amount ?? 0;

    return {
      triggerId,
      eventId: event.id,
      eventName: event.eventName,
      eventDate: eventDate.toISOString().slice(0, 10),
      daysUntilEvent,
      clientName: event.clientName,
      totalBudget: 0,
      spentBudget,
      remainingBudget: 9999999,
      withdrawnSupplier: {
        id: request.supplierId ?? '',
        name: request.supplierName,
        category: request.category,
        tier: request.supplier?.tier ?? 'unknown',
        quotedAmount,
      },
      clientPreferences,
    };
  }
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new Error('PARE execution aborted');
}
