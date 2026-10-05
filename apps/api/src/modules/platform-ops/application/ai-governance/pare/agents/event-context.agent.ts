import type { PAREContext } from '../pare.types';
import { PareSourceNotFoundError } from '../pare-source.errors';
import type { PareEventSource } from '@prism/contexts/read-models';

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
  async buildPareEventContext(
    triggerId: string,
    source: PareEventSource,
    requireWithdrawn = false,
    signal?: AbortSignal,
  ): Promise<PAREContext> {
    throwIfAborted(signal);
    if (source.request.id !== triggerId || source.request.eventId !== source.event.id) {
      throw new PareSourceNotFoundError(`PARE: quote request ${triggerId} has no matching event source`);
    }
    assertWithdrawnSource(source.request, triggerId, requireWithdrawn);

    const eventDate = new Date(source.event.eventDate);
    const now = new Date();
    const daysUntilEvent = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    let clientPreferences: string[] = [];
    if (source.latestBriefingRequirements) {
      const requirements = source.latestBriefingRequirements;
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

    const spentBudget = source.selectedQuotes.reduce((sum, quote) => sum + (quote.amount ?? 0), 0);
    throwIfAborted(signal);
    const withdrawnQuote = source.selectedQuotes.find((quote) => quote.requestId === triggerId);
    const quotedAmount = withdrawnQuote?.amount ?? 0;

    return {
      triggerId,
      eventId: source.event.id,
      eventName: source.event.eventName,
      eventDate: eventDate.toISOString().slice(0, 10),
      daysUntilEvent,
      clientName: source.event.clientName,
      totalBudget: 0,
      spentBudget,
      remainingBudget: 9999999,
      withdrawnSupplier: {
        id: source.request.supplierId ?? '',
        name: source.request.supplierName,
        category: source.request.category,
        tier: source.request.supplierTier ?? 'unknown',
        quotedAmount,
      },
      clientPreferences,
    };
  }
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new Error('PARE execution aborted');
}
