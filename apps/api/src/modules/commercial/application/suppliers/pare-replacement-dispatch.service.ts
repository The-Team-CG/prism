import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '@prism/kernel/database';
import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { NOTIFICATION_OUTBOX_WRITER, type NotificationOutboxWriter, writeNotification } from '@prism/contexts/platform-ops';
import { CommercialWorkflowService } from '../quotes/commercial-workflow.service';
import { SupplierNetworkWorkflowService } from './supplier-network-workflow.service';

/**
 * FR-AI-04b: once PMCM approves a PARE recommendation, the chosen replacement supplier gets the normal
 * quote request in the withdrawn category plus PARE's supplier notice, which PMCM has just reviewed.
 * The supplier then quotes and confirms through their portal as usual; nothing is booked automatically.
 */
@Injectable()
export class PareReplacementDispatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supplierWorkflow: SupplierNetworkWorkflowService,
    private readonly commercialWorkflow: CommercialWorkflowService,
    @Inject(NOTIFICATION_OUTBOX_WRITER) private readonly notificationOutboxWriter: NotificationOutboxWriter,
  ) {}

  async approve(approvalRecordId: string, actor: ResolvedEventOpsActor) {
    const record = await this.supplierWorkflow.pareApprove(approvalRecordId, actor.name);
    const candidate = record.pareResult?.budgetAnalysis?.selectedCandidate;
    const notice = record.pareResult?.drafts?.supplierNotification;
    if (!candidate || !notice) return { ...record, replacementRequested: false };

    const withdrawn = await this.prisma.opsSupplierQuoteRequest.findUnique({
      where: { id: record.requestId },
      select: { categoryId: true },
    });
    if (!withdrawn?.categoryId) return { ...record, replacementRequested: false };

    await this.commercialWorkflow.requestSupplierQuotes(record.eventId, { categoryId: withdrawn.categoryId, supplierIds: [candidate.supplierId] }, actor);
    const supplier = await this.prisma.opsSupplier.findUnique({ where: { id: candidate.supplierId }, select: { email: true } });
    // PARE drafts keep name placeholders; the supplier sees its own name and never the client's.
    const message = notice.replaceAll('[Supplier name]', candidate.supplierName).replaceAll('[Client name]', 'our client');
    await writeNotification(this.notificationOutboxWriter, record.eventId, supplier?.email.trim() || candidate.supplierName, message, 'email', {
      idempotencyKey: `pare-supplier-notice:${approvalRecordId}`,
    });
    return { ...record, replacementRequested: true };
  }
}
