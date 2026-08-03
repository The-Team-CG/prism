import { PrismaService } from '@prism/database';
import type { PAREContext, PARESupplierRecord, PARETriggerInput } from '@prism/types';

/**
 * The database side of PARE: reads the rows a withdrawal is judged from and
 * hands them over as plain contract shapes.
 *
 * This stays in the API on purpose. The agents reason; the API owns data access,
 * so the agent apps never need a database connection.
 */
export class PareSourceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Collect the withdrawal facts for a quote request.
   *
   * `prefetched` is passed by the supplier withdrawal workflow, which has
   * already loaded both rows. Quote and briefing reads are individually
   * tolerant: PARE still produces a recommendation when they are unavailable.
   */
  async loadTriggerInput(
    triggerId: string,
    prefetched?: { request: any; event: any },
  ): Promise<PARETriggerInput> {
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

    return {
      triggerId,
      event: {
        id: event.id,
        eventName: event.eventName,
        eventDate: new Date(event.eventDate).toISOString(),
        clientName: event.clientName,
      },
      withdrawnRequest: {
        supplierId: request.supplierId ?? null,
        supplierName: request.supplierName,
        category: request.category,
        supplierTier: request.supplier?.tier ?? null,
      },
      selectedQuotes: await this.loadSelectedQuotes(event.id),
      briefingServiceRequirements: await this.loadBriefingRequirements(event.id),
    };
  }

  /** Suppliers in the withdrawn category that are candidates for this event. */
  async loadCandidateSuppliers(ctx: PAREContext): Promise<PARESupplierRecord[]> {
    const { withdrawnSupplier, eventId } = ctx;

    try {
      const category = await this.prisma.opsSupplierCategory.findFirst({
        where: { name: withdrawnSupplier.category },
      });
      if (!category) return [];

      const suppliers = await this.prisma.opsSupplier.findMany({
        where: {
          categoryId: category.id,
          id: { not: withdrawnSupplier.id },
          NOT: { name: withdrawnSupplier.name },
        },
        include: {
          reviews: true,
          reliabilityNotes: true,
          certifications: true,
          quoteRequests: { where: { eventId } },
          quotes: { where: { eventId } },
        },
      });

      return suppliers.map((supplier: any) => ({
        id: supplier.id,
        name: supplier.name,
        tier: supplier.tier,
        serviceInclusions: supplier.serviceInclusions ?? null,
        performanceNotes: supplier.performanceNotes ?? null,
        reviews: (supplier.reviews ?? []).map((review: any) => ({ rating: review.rating })),
        quoteRequests: (supplier.quoteRequests ?? []).map((request: any) => ({
          assignmentStatus: request.assignmentStatus ?? null,
        })),
        quotes: (supplier.quotes ?? []).map((quote: any) => ({ amount: quote.amount ?? null })),
      }));
    } catch {
      return [];
    }
  }

  private async loadSelectedQuotes(eventId: string) {
    try {
      const quotes = await this.prisma.opsSupplierQuote.findMany({
        where: { eventId, status: 'selected' },
      });
      return quotes.map((quote: any) => ({
        requestId: quote.requestId ?? null,
        amount: quote.amount ?? null,
      }));
    } catch {
      return []; // DB unavailable — proceed with no spend on record
    }
  }

  private async loadBriefingRequirements(eventId: string): Promise<unknown> {
    try {
      const briefings = await this.prisma.opsBriefing.findMany({
        where: { eventId },
        orderBy: { submittedAt: 'desc' },
        take: 1,
      });
      return briefings[0]?.serviceRequirements ?? null;
    } catch {
      return null; // DB unavailable — no preferences
    }
  }
}
