import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@prism/kernel/database';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventAccessPolicyService, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { SUPPLIER_RESPONSE_WINDOW_HOURS, type PrismSupplierReliabilityScore } from '@prism/types';
import { supplierReliabilityScore } from '../../domain/supplier-reliability-score';

const HISTORY_LIMIT = 200;

/** FR-AI-06: reads one supplier's history and scores it; PMCM sees it on the supplier profile. */
@Injectable()
export class SupplierReliabilityScoreService {
  constructor(private readonly prisma: PrismaService, private readonly access: EventAccessPolicyService) {}

  async score(supplierId: string, actor: ResolvedEventOpsActor): Promise<PrismSupplierReliabilityScore> {
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'supplier reliability score');
    const supplier = await this.prisma.opsSupplier.findUnique({ where: { id: supplierId }, select: { id: true } });
    if (!supplier) throw new NotFoundException('Supplier not found');
    const [requests, reviews, notes] = await Promise.all([
      this.prisma.opsSupplierQuoteRequest.findMany({
        where: { supplierId }, orderBy: { createdAt: 'desc' }, take: HISTORY_LIMIT,
        select: { id: true, createdAt: true, status: true, assignmentStatus: true, eventDayStatus: true, quotes: { select: { createdAt: true }, orderBy: { createdAt: 'asc' }, take: 1 } },
      }),
      this.prisma.opsSupplierReview.findMany({ where: { supplierId }, select: { rating: true }, take: HISTORY_LIMIT }),
      this.prisma.opsSupplierReliabilityNote.findMany({ where: { supplierId }, select: { idempotencyKey: true }, take: HISTORY_LIMIT }),
    ]);
    const booked = requests.filter((request) => request.status === 'selected' && request.assignmentStatus === 'confirmed');
    const keys = notes.map((note) => note.idempotencyKey ?? '');
    const noShows = keys.filter((key) => key.startsWith('supplier-no-show-note:')).length;
    const late = booked.filter((request) => request.eventDayStatus === 'late').length;
    const windowMs = SUPPLIER_RESPONSE_WINDOW_HOURS * 3_600_000;
    const responsive = requests.filter((request) => request.quotes[0] && request.quotes[0].createdAt.getTime() - request.createdAt.getTime() <= windowMs).length;
    return supplierReliabilityScore({
      onTime: { successes: Math.max(0, booked.length - Math.max(late, noShows)), observations: booked.length },
      noComplaints: { successes: reviews.filter((review) => review.rating > 2).length, observations: reviews.length },
      responsive: { successes: responsive, observations: requests.length },
      contractAccuracy: { successes: Math.max(0, booked.length - keys.filter((key) => key.startsWith('supplier-contract-mismatch-note:')).length), observations: booked.length },
    });
  }
}
