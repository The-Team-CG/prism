import type { PAREContext } from '../pare.types';

export class EventContextAgent {
  constructor(private readonly prisma: any) {}

  async run(triggerId: string, prefetched?: { request: any; event: any }): Promise<PAREContext> {
    let request: any;
    let event: any;

    if (prefetched) {
      request = prefetched.request;
      event = prefetched.event;
    } else {
      const fetched = await this.prisma.opsSupplierQuoteRequest.findUnique({
        where: { id: triggerId },
        include: { event: true, supplier: true, categoryRef: true },
      });
      if (!fetched) throw new Error(`PARE: quote request ${triggerId} not found`);
      request = fetched;
      event = fetched.event;
    }

    const eventDate = new Date(event.eventDate);
    const now = new Date();
    const daysUntilEvent = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    let allQuotes: any[] = [];
    let clientPreferences: string[] = [];

    try {
      allQuotes = await this.prisma.opsSupplierQuote.findMany({
        where: { eventId: event.id, status: 'selected' },
      });
    } catch { /* DB unavailable — proceed with empty quotes */ }

    try {
      const briefings = await this.prisma.opsBriefing.findMany({
        where: { eventId: event.id },
        orderBy: { createdAt: 'desc' },
        take: 1,
      });
      if (briefings.length > 0 && briefings[0].preferences) {
        const prefs = briefings[0].preferences;
        if (typeof prefs === 'object' && prefs !== null) {
          Object.entries(prefs as Record<string, unknown>).forEach(([k, v]) => {
            if (v && typeof v !== 'object') clientPreferences.push(`${k}: ${v}`);
          });
        }
      }
    } catch { /* DB unavailable — no preferences */ }

    const spentBudget = allQuotes.reduce((sum: number, q: any) => sum + (q.amount ?? 0), 0);
    const withdrawnQuote = allQuotes.find((q: any) => q.requestId === triggerId);
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
