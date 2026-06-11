import { NotFoundException } from '@nestjs/common';
import type { OpsSupplierQuote, Prisma } from '@prisma/client';
import type { PrismaService } from '@prism/database';
import { AuditCategory, SupplierQuoteRequestStatus, SupplierQuoteStatus } from '../ops.constants';
import { AuditService } from './audit.service';
import { NotificationOutboxService } from './notification-outbox.service';
import { WorkflowCommandService } from './workflow-command.service';

type SelectSupplierQuoteResult = {
  quote: OpsSupplierQuote;
  selectedNow: boolean;
};

export class CommercialWorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationOutboxService: NotificationOutboxService,
    private readonly workflowCommandService: WorkflowCommandService,
  ) {}

  async selectSupplierQuote(eventId: string, quoteId: string, actorName = 'PMCM Admin') {
    let quote: OpsSupplierQuote | null = null;

    return this.workflowCommandService.execute<SelectSupplierQuoteResult, OpsSupplierQuote>({
      name: 'select_supplier_quote',
      eventId,
      validateState: async () => {
        const [event, foundQuote] = await Promise.all([
          this.prisma.opsEvent.findUnique({ where: { id: eventId } }),
          this.prisma.opsSupplierQuote.findUnique({ where: { id: quoteId } }),
        ]);
        if (!event) throw new NotFoundException('Event not found');
        if (!foundQuote || foundQuote.eventId !== eventId) throw new NotFoundException('Supplier quote not found');
        quote = foundQuote;
      },
      write: async () => {
        if (!quote) throw new NotFoundException('Supplier quote not found');
        if ([SupplierQuoteStatus.Selected, SupplierQuoteStatus.Locked].includes(quote.status as any)) {
          return { quote, selectedNow: false };
        }

        const selected = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          await tx.opsSupplierQuote.updateMany({
            where: { eventId, category: quote!.category, id: { not: quote!.id } },
            data: { status: SupplierQuoteStatus.NotSelected },
          });

          const nextSelected = await tx.opsSupplierQuote.update({
            where: { id: quote!.id },
            data: { status: SupplierQuoteStatus.Selected, selectedAt: new Date(), lockedAt: new Date() },
          });

          if (quote!.requestId) {
            await tx.opsSupplierQuoteRequest.update({
              where: { id: quote!.requestId },
              data: { status: SupplierQuoteRequestStatus.Selected },
            });
          }

          await tx.opsSupplierQuoteRequest.updateMany({
            where: {
              eventId,
              ...(quote!.categoryId ? { categoryId: quote!.categoryId } : {}),
              ...(quote!.requestId ? { id: { not: quote!.requestId } } : {}),
            },
            data: { status: SupplierQuoteRequestStatus.Closed },
          });

          return nextSelected;
        });

        return { quote: selected, selectedNow: true };
      },
      sideEffects: async (result) => {
        if (!result.selectedNow) return;
        await Promise.all([
          this.auditService.audit(eventId, actorName, `Selected supplier quote: ${result.quote.supplierName}`, {
            category: AuditCategory.Suppliers,
            affectedType: 'supplier_quote',
            affectedId: result.quote.id,
            affectedLabel: result.quote.supplierName,
          }),
          this.notificationOutboxService.queue(eventId, result.quote.supplierName, 'Your supplier quote was selected'),
        ]);
      },
      project: (result) => result.quote,
    });
  }
}
