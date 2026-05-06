import type { PAREContext } from '../pare.types';

export class EventContextAgent {
  constructor(private readonly prisma: any) {}

  async run(triggerId: string): Promise<PAREContext> {
    const request = await this.prisma.opsSupplierQuoteRequest.findUnique({
      where: { id: triggerId },
      include: { event: true, supplier: true, categoryRef: true },
    });
    if (!request) throw new Error(`PARE: quote request ${triggerId} not found`);

    const event = request.event;
    const eventDate = new Date(event.eventDate);
    const now = new Date();
    const daysUntilEvent = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Sum all confirmed supplier quotes for this event to get spent budget
    const allQuotes = await this.prisma.opsSupplierQuote.findMany({
      where: { eventId: event.id, status: 'selected' },
    });
    const spentBudget = allQuotes.reduce((sum: number, q: any) => sum + (q.amount ?? 0), 0);

    // Pull client preferences from briefings if any
    const briefings = await this.prisma.opsBriefing.findMany({
      where: { eventId: event.id },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });
    const clientPreferences: string[] = [];
    if (briefings.length > 0 && briefings[0].preferences) {
      const prefs = briefings[0].preferences;
      if (typeof prefs === 'object' && prefs !== null) {
        Object.entries(prefs as Record<string, unknown>).forEach(([k, v]) => {
          if (v) clientPreferences.push(`${k}: ${v}`);
        });
      }
    }

    const withdrawnQuote = allQuotes.find((q: any) => q.requestId === triggerId);
    const quotedAmount = withdrawnQuote?.amount ?? 0;

    return {
      triggerId,
      eventId: event.id,
      eventName: event.eventName,
      eventDate: eventDate.toISOString().slice(0, 10),
      daysUntilEvent,
      clientName: event.clientName,
      totalBudget: 0, // Budget not stored on OpsEvent — use remaining logic
      spentBudget,
      remainingBudget: 9999999, // Conservative: unknown budget means we don't block
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
