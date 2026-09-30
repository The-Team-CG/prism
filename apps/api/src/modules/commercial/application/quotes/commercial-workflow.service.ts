import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { OpsSupplier, OpsSupplierCategory, OpsSupplierQuote, OpsSupplierQuoteRequest, Prisma } from '@prisma/client';
import { PrismaService } from '@prism/kernel/database';
import { toPrismaJson } from '@prism/kernel/database';
import { randomUUID } from 'node:crypto';
import { AuditActionType, AuditCategory, SupplierQuoteRequestStatus, SupplierQuoteStatus, WorkflowCommandService, isOpsConstantValue } from '@prism/kernel/event-core';
import { NOTIFICATION_OUTBOX_WRITER, type NotificationOutboxWriter, writeNotification } from '@prism/contexts/platform-ops';
import { AUDIT_WRITER, type AuditWriter, writeAudit } from '@prism/kernel/access-control';
import {
  isSupplierQuoteLocked,
  isSupplierQuoteRequestClosed,
  resolveExpiredQuoteRequestStatus,
} from '../../domain/supplier-quote-request.policy';
import type { AddSupplierQuoteInput } from '../../contracts/commercial-workflow-commands.port';
import type { SupplierAvailabilityInput } from '@prism/types';
import { QUOTE_SUPPLIER_RESOLVER } from '../../contracts/commercial-ops.tokens';
import type { QuoteSupplierResolver } from '../../contracts/quote-supplier-resolver.port';

type SelectSupplierQuoteResult = {
  quote: OpsSupplierQuote;
  selectedNow: boolean;
};

export type QuoteRequestTokenDetail = {
  request: OpsSupplierQuoteRequest;
  event: { id: string; eventName: string; clientName: string; eventDate: Date };
  quote: OpsSupplierQuote | null;
};

export type RequestSupplierQuotesInput = {
  categoryId: string;
  supplierIds?: string[];
  confidentialBid?: boolean;
  deadline?: string;
};

export type SubmitSupplierQuoteInput = {
  amount: number;
  inclusions?: string[];
  paymentTerms?: string;
  notes?: string;
};

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function parseDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new BadRequestException('Invalid date');
  return parsed;
}

function assertQuoteSaveAllowed(
  requestedMode: 'submit' | 'revise',
  quote: OpsSupplierQuote | null,
  input: Partial<SubmitSupplierQuoteInput>,
): 'submit' | 'revise' {
  if (requestedMode === 'revise' && !quote) throw new NotFoundException('Supplier quote not found');
  if (quote && isSupplierQuoteLocked(quote.status)) {
    throw new BadRequestException('Supplier quote is already locked');
  }
  if (quote && quote.revisionNumber >= 2) {
    throw new BadRequestException('Quote has already been revised and cannot be revised again.');
  }
  const effectiveMode = quote ? 'revise' : 'submit';
  if (effectiveMode === 'submit' && input.amount === undefined) {
    throw new BadRequestException('Quote amount is required');
  }
  return effectiveMode;
}

function quoteOutsideAcceptableRange(category: OpsSupplierCategory | null, amount: number) {
  const belowMin = typeof category?.acceptableMin === 'number' && amount < category.acceptableMin;
  const aboveMax = typeof category?.acceptableMax === 'number' && amount > category.acceptableMax;
  return Boolean(belowMin || aboveMax);
}

@Injectable()
export class CommercialWorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
    @Inject(NOTIFICATION_OUTBOX_WRITER) private readonly notificationOutboxWriter: NotificationOutboxWriter,
    private readonly workflowCommandService: WorkflowCommandService,
    @Inject(QUOTE_SUPPLIER_RESOLVER) private readonly quoteSupplierResolver: QuoteSupplierResolver,
  ) {}

  async requestSupplierQuotes(eventId: string, input: RequestSupplierQuotesInput) {
    let event: { eventName: string; clientName: string } | null = null;
    let category: OpsSupplierCategory | null = null;
    let suppliersToRequest: OpsSupplier[] = [];
    let dueDate: Date | null = null;

    return this.workflowCommandService.execute<OpsSupplierQuoteRequest[], OpsSupplierQuoteRequest[]>({
      name: 'request_supplier_quotes',
      eventId,
      validateState: async () => {
        event = await this.prisma.opsEvent.findUnique({
          where: { id: eventId },
          select: { eventName: true, clientName: true },
        });
        if (!event) throw new NotFoundException('Event not found');

        category = await this.prisma.opsSupplierCategory.findUnique({ where: { id: input.categoryId } });
        if (!category) throw new NotFoundException('Supplier category not found');

        const selectedSuppliers =
          input.supplierIds && input.supplierIds.length > 0
            ? await this.prisma.opsSupplier.findMany({
                where: { id: { in: input.supplierIds }, categoryId: category.id },
                orderBy: { name: 'asc' },
              })
            : await this.prisma.opsSupplier.findMany({
                where: { categoryId: category.id, tier: 'tier_1' },
                orderBy: { name: 'asc' },
              });

        if (selectedSuppliers.length === 0) {
          throw new BadRequestException('Select at least one supplier for this quote request');
        }

        const selectedSupplierIds = new Set(selectedSuppliers.map((supplier) => supplier.id));
        const duplicateRequestSupplierIds = new Set(
          (
            await this.prisma.opsSupplierQuoteRequest.findMany({
              where: { eventId },
            })
          )
            .filter(
              (request) =>
                request.categoryId === category!.id &&
                request.supplierId &&
                selectedSupplierIds.has(request.supplierId) &&
                isOpsConstantValue(SupplierQuoteRequestStatus, request.status) &&
                request.status !== SupplierQuoteRequestStatus.Closed &&
                request.status !== SupplierQuoteRequestStatus.Expired,
            )
            .map((request) => request.supplierId as string),
        );
        suppliersToRequest = selectedSuppliers.filter((supplier) => !duplicateRequestSupplierIds.has(supplier.id));
        if (suppliersToRequest.length === 0) {
          throw new BadRequestException('Selected suppliers already have active quote requests for this event and category');
        }

        dueDate = input.deadline ? parseDate(input.deadline) : null;
      },
      write: () => {
        if (!event || !category) throw new NotFoundException('Supplier category not found');
        return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          const roundModel = (tx as Prisma.TransactionClient & { opsSupplierQuoteRound?: any }).opsSupplierQuoteRound;
          const latestRound = roundModel ? await roundModel.findFirst({ where: { eventId, categoryId: category!.id }, orderBy: { roundNumber: 'desc' } }) : null;
          const round = roundModel ? await roundModel.create({ data: { id: `round_${randomUUID()}`, eventId, categoryId: category!.id, roundNumber: (latestRound?.roundNumber ?? 0) + 1 } }) : null;
          // Transaction scope: DB reads/writes only. No external IO inside this callback.
          const requestData = suppliersToRequest.map((supplier) => {
            const token = randomUUID();
            return {
              id: `qr_${randomUUID()}`,
              eventId,
              supplierId: supplier.id,
              categoryId: category!.id,
              supplierName: supplier.name,
              category: category!.name,
              dueDate,
              accessToken: token,
              confidentialBid: Boolean(input.confidentialBid),
              message: input.confidentialBid
                ? `${event!.eventName} quote request with client details hidden until selection.`
                : `${event!.clientName} / ${event!.eventName} quote request.`,
              status: SupplierQuoteRequestStatus.Open,
              ...(round ? { roundId: round.id } : {}),
            };
          });
          const created = await tx.opsSupplierQuoteRequest.createManyAndReturn({ data: requestData });
          const supplierOrder = new Map(suppliersToRequest.map((supplier, index) => [supplier.id, index]));
          return created.sort((left, right) =>
            (supplierOrder.get(left.supplierId ?? '') ?? Number.MAX_SAFE_INTEGER) -
            (supplierOrder.get(right.supplierId ?? '') ?? Number.MAX_SAFE_INTEGER),
          );
        });
      },
      sideEffects: async (requests) => {
        if (!category) return;
        const notifications = requests.flatMap((request) => {
          const supplier = suppliersToRequest.find((item) => item.id === request.supplierId);
          return [
            writeNotification(this.notificationOutboxWriter,
              eventId,
              supplier?.email || request.supplierName,
              `Quote request link: /quote-requests/${request.accessToken}`,
            ),
            writeNotification(this.notificationOutboxWriter,
              eventId,
              supplier?.phone || request.supplierName,
              `Quote request link: /quote-requests/${request.accessToken}`,
              'viber',
            ),
          ];
        });
        await Promise.all([
          ...notifications,
          writeAudit(this.auditWriter,
            eventId,
            'PMCM Admin',
            `Requested ${category.name} quotes from ${requests.length} supplier${requests.length === 1 ? '' : 's'}`,
            {
              category: AuditCategory.Suppliers,
              actionType: 'create',
              affectedType: 'supplier_quote_request',
              metadata: {
                confidentialBid: Boolean(input.confidentialBid),
                deadline: dueDate ? isoDate(dueDate) : null,
              },
            },
          ),
        ]);
      },
    });
  }

  async addSupplierQuote(eventId: string, input: AddSupplierQuoteInput) {
    let supplierName: string | undefined;
    let category: string | undefined;
    let categoryId: string | null = null;
    let amount = 0;
    let outsideAcceptableRange = false;
    let categoryRange: OpsSupplierCategory | null = null;
    let directorySupplier: Awaited<ReturnType<QuoteSupplierResolver['resolveQuoteSupplier']>> = null;

    return this.workflowCommandService.execute<OpsSupplierQuote>({
      name: 'add_supplier_quote',
      eventId,
      validateState: async () => {
        const event = await this.prisma.opsEvent.findUnique({ where: { id: eventId } });
        if (!event) throw new NotFoundException('Event not found');

        directorySupplier = await this.quoteSupplierResolver.resolveQuoteSupplier(input);

        supplierName = directorySupplier?.name ?? input.supplierName;
        category = directorySupplier?.category.name ?? input.category;
        categoryId = directorySupplier?.categoryId ?? input.categoryId ?? null;
        if (!supplierName || !category) {
          throw new BadRequestException('Supplier name and category are required');
        }

        categoryRange = categoryId
          ? await this.prisma.opsSupplierCategory.findUnique({ where: { id: categoryId } })
          : null;
        amount = input.amount ?? 0;
        outsideAcceptableRange =
          amount > 0 &&
          Boolean(
            (typeof categoryRange?.acceptableMin === 'number' && amount < categoryRange.acceptableMin) ||
              (typeof categoryRange?.acceptableMax === 'number' && amount > categoryRange.acceptableMax),
          );
      },
      write: () => {
        if (!supplierName || !category) throw new BadRequestException('Supplier name and category are required');
        return this.prisma.opsSupplierQuote.create({
          data: {
            id: `quote_${randomUUID()}`,
            eventId,
            requestId: input.requestId ?? null,
            supplierId: directorySupplier?.id ?? null,
            categoryId,
            supplierName,
            category,
            amount,
            inclusions: toPrismaJson(input.inclusions ?? []),
            paymentTerms: input.paymentTerms ?? '',
            notes: input.notes ?? '',
            acceptableMin: categoryRange?.acceptableMin ?? null,
            acceptableMax: categoryRange?.acceptableMax ?? null,
            outsideAcceptableRange,
            status: input.status ?? SupplierQuoteStatus.Received,
          },
        });
      },
      sideEffects: async (quote) => {
        await Promise.all([
          writeAudit(this.auditWriter,
            eventId,
            input.status === 'requested' ? 'PMCM Admin' : 'Supplier',
            `${input.status === 'requested' ? 'Requested' : 'Submitted'} supplier quote: ${quote.supplierName}`,
            {
              category: AuditCategory.Suppliers,
              affectedType: 'supplier_quote',
              affectedId: quote.id,
              affectedLabel: quote.supplierName,
            },
          ),
          writeNotification(this.notificationOutboxWriter,
            eventId,
            input.status === 'requested' ? quote.supplierName : 'PMCM Admin',
            input.status === 'requested' ? 'Supplier quote request issued' : 'Supplier quote received',
          ),
        ]);
      },
    });
  }

  async getQuoteRequestByToken(token: string): Promise<QuoteRequestTokenDetail> {
    const request = await this.prisma.opsSupplierQuoteRequest.findUnique({ where: { accessToken: token } });
    if (!request) throw new NotFoundException('Quote request not found');

    const requestWithStatus = await this.expireQuoteRequestIfNeeded(request);
    const [event, quote] = await Promise.all([
      this.prisma.opsEvent.findUnique({
        where: { id: requestWithStatus.eventId },
        select: { id: true, eventName: true, clientName: true, eventDate: true },
      }),
      this.prisma.opsSupplierQuote.findFirst({
        where: { requestId: requestWithStatus.id },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    if (!event) throw new NotFoundException('Event not found');

    return { request: requestWithStatus, event, quote };
  }

  async submitSupplierQuoteByToken(token: string, input: SubmitSupplierQuoteInput) {
    return this.saveSupplierQuoteByToken(token, input, 'submit');
  }

  async reviseSupplierQuoteByToken(token: string, input: Partial<SubmitSupplierQuoteInput>) {
    return this.saveSupplierQuoteByToken(token, input, 'revise');
  }

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
        if (isSupplierQuoteLocked(quote.status)) {
          return { quote, selectedNow: false };
        }

        const selected = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          await this.assertSupplierCapacityAvailable(tx, eventId, quote!);
          // Transaction scope: DB reads/writes only. No external IO inside this callback.
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
          writeAudit(this.auditWriter, eventId, actorName, `Selected supplier quote: ${result.quote.supplierName}`, {
            category: AuditCategory.Suppliers,
            affectedType: 'supplier_quote',
            affectedId: result.quote.id,
            affectedLabel: result.quote.supplierName,
          }),
          writeNotification(this.notificationOutboxWriter, eventId, result.quote.supplierName, 'Your supplier quote was selected'),
        ]);
      },
      project: (result) => result.quote,
    });
  }

  async setSupplierAvailability(supplierId: string, input: SupplierAvailabilityInput, actorName = 'PMCM Admin') {
    const availableOn = new Date(`${input.availableOn}T00:00:00.000Z`);
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const result = await tx.opsSupplierAvailability.upsert({
        where: { supplierId_availableOn: { supplierId, availableOn } },
        create: { id: `avail_${randomUUID()}`, supplierId, availableOn, capacity: input.capacity, blocked: Boolean(input.blocked), notes: input.notes ?? '' },
        update: { capacity: input.capacity, blocked: Boolean(input.blocked), notes: input.notes ?? '' },
      });
      await writeAudit(this.auditWriter, undefined, actorName, `Updated supplier availability: ${supplierId}`, {
        actorRole: 'pmcm-admin', actionType: AuditActionType.Update, category: AuditCategory.Suppliers,
        affectedType: 'supplier_availability', affectedId: result.id, metadata: { supplierId, availableOn: input.availableOn, capacity: input.capacity, blocked: Boolean(input.blocked) },
      }, { prisma: tx, actorId: actorName, correlationId: `supplier-availability:${result.id}` });
      return result;
    });
  }

  async getQuoteRoundComparison(eventId: string, roundId: string, actorRole: string) {
    if (actorRole === 'supplier') throw new BadRequestException('Supplier comparison access is forbidden');
    const round = await this.prisma.opsSupplierQuoteRound.findFirst({ where: { id: roundId, eventId }, include: { requests: { include: { quotes: true } }, category: true } });
    if (!round) throw new NotFoundException('Quote round not found');
    return { id: round.id, eventId: round.eventId, category: round.category.name, roundNumber: round.roundNumber, status: round.status,
      bids: round.requests.flatMap((request) => request.quotes.map((quote) => ({ id: quote.id, supplierId: quote.supplierId, supplierName: quote.supplierName, amount: quote.amount, inclusions: quote.inclusions, paymentTerms: quote.paymentTerms, notes: quote.notes, outsideAcceptableRange: quote.outsideAcceptableRange, status: quote.status }))) };
  }

  private async assertSupplierCapacityAvailable(tx: Prisma.TransactionClient, eventId: string, quote: OpsSupplierQuote) {
    if (!quote.supplierId) return;
    const eventDate = await tx.opsEvent.findUnique({ where: { id: eventId }, select: { eventDate: true } });
    const availabilityModel = (tx as Prisma.TransactionClient & { opsSupplierAvailability?: any }).opsSupplierAvailability;
    if (!eventDate || !availabilityModel) return;
    const availability = await availabilityModel.findUnique({ where: { supplierId_availableOn: { supplierId: quote.supplierId, availableOn: eventDate.eventDate } } });
    if (availability && (availability.blocked || availability.capacity < 1)) throw new BadRequestException('Supplier gap warning: supplier is unavailable for the event date');
    if (!availability) return;
    const assignedCount = await tx.opsSupplierQuoteRequest.count({ where: { eventId, supplierId: quote.supplierId, status: SupplierQuoteRequestStatus.Selected, assignmentStatus: { in: ['pending_confirmation', 'confirmed'] } } });
    if (assignedCount >= availability.capacity) throw new BadRequestException('Supplier gap warning: supplier capacity is already committed for the event date');
  }

  private async saveSupplierQuoteByToken(
    token: string,
    input: Partial<SubmitSupplierQuoteInput>,
    requestedMode: 'submit' | 'revise',
  ) {
    let request: OpsSupplierQuoteRequest | null = null;
    let quote: OpsSupplierQuote | null = null;
    let category: OpsSupplierCategory | null = null;
    let amount = 0;
    let outsideAcceptableRange = false;
    let effectiveMode: 'submit' | 'revise' = requestedMode;
    const revisedAt = new Date();

    return this.workflowCommandService.execute<OpsSupplierQuote>({
      name: requestedMode === 'submit' ? 'submit_supplier_quote_by_token' : 'revise_supplier_quote_by_token',
      validateState: async () => {
        const foundRequest = await this.prisma.opsSupplierQuoteRequest.findUnique({ where: { accessToken: token } });
        if (!foundRequest) throw new NotFoundException('Quote request not found');

        request = await this.expireQuoteRequestIfNeeded(foundRequest);
        if (isSupplierQuoteRequestClosed(request.status)) {
          throw new BadRequestException('Quote request is already closed');
        }

        quote = await this.prisma.opsSupplierQuote.findFirst({ where: { requestId: request.id } });
        effectiveMode = assertQuoteSaveAllowed(requestedMode, quote, input);
        category = request.categoryId
          ? await this.prisma.opsSupplierCategory.findUnique({ where: { id: request.categoryId } })
          : null;
        amount = input.amount ?? quote?.amount ?? 0;
        outsideAcceptableRange = quoteOutsideAcceptableRange(category, amount);
      },
      write: () => {
        if (!request) throw new NotFoundException('Quote request not found');
        const activeRequest = request;
        return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          // Transaction scope: DB reads/writes only. No external IO inside this callback.
          if (effectiveMode === 'revise') {
            if (!quote) throw new NotFoundException('Supplier quote not found');
            // AC4 is re-asserted here as a compare-and-swap rather than trusting the
            // validateState read: that read happens outside this transaction, so two
            // concurrent revisions can both clear the guard. Scoping the write to
            // `revisionNumber < 2` and incrementing atomically means the loser of the
            // race matches no rows and is rejected instead of silently overwriting.
            const { count } = await tx.opsSupplierQuote.updateMany({
              where: { id: quote.id, revisionNumber: { lt: 2 } },
              data: {
                amount,
                ...(input.inclusions ? { inclusions: toPrismaJson(input.inclusions) } : {}),
                ...(input.paymentTerms !== undefined ? { paymentTerms: input.paymentTerms } : {}),
                ...(input.notes !== undefined ? { notes: input.notes } : {}),
                acceptableMin: category?.acceptableMin ?? quote.acceptableMin ?? null,
                acceptableMax: category?.acceptableMax ?? quote.acceptableMax ?? null,
                outsideAcceptableRange,
                status: SupplierQuoteStatus.Revised,
                revisionNumber: { increment: 1 },
                revisedAt,
              },
            });
            if (count === 0) {
              throw new BadRequestException('Quote has already been revised and cannot be revised again.');
            }
            const saved = await tx.opsSupplierQuote.findUniqueOrThrow({ where: { id: quote.id } });
            await tx.opsSupplierQuoteRequest.update({
              where: { id: activeRequest.id },
              data: { status: SupplierQuoteRequestStatus.Revised },
            });
            return saved;
          }

          const saved = await tx.opsSupplierQuote.create({
            data: {
              id: `quote_${randomUUID()}`,
              eventId: activeRequest.eventId,
              requestId: activeRequest.id,
              supplierId: activeRequest.supplierId ?? null,
              categoryId: activeRequest.categoryId ?? null,
              supplierName: activeRequest.supplierName,
              category: activeRequest.category,
              amount,
              inclusions: toPrismaJson(input.inclusions ?? []),
              paymentTerms: input.paymentTerms ?? '',
              notes: input.notes ?? '',
              acceptableMin: category?.acceptableMin ?? null,
              acceptableMax: category?.acceptableMax ?? null,
              outsideAcceptableRange,
              status: SupplierQuoteStatus.Received,
              revisionNumber: 1,
            },
          });
          await tx.opsSupplierQuoteRequest.update({
            where: { id: activeRequest.id },
            data: { status: SupplierQuoteRequestStatus.Submitted },
          });
          return saved;
        });
      },
      sideEffects: async (saved) => {
        if (!request) return;
        await Promise.all([
          writeAudit(this.auditWriter,
            request.eventId,
            'Supplier',
            `${effectiveMode === 'revise' ? 'Revised' : 'Submitted'} quote from ${request.supplierName}`,
            {
              category: AuditCategory.Suppliers,
              actionType: effectiveMode === 'revise' ? 'update' : 'create',
              affectedType: 'supplier_quote',
              affectedId: saved.id,
              affectedLabel: request.supplierName,
            },
          ),
          writeNotification(this.notificationOutboxWriter,
            request.eventId,
            'PMCM Admin',
            `${request.supplierName} ${effectiveMode === 'revise' ? 'revised' : 'submitted'} a ${request.category} quote`,
          ),
        ]);
      },
    });
  }

  private withExpiredQuoteRequestStatus(request: OpsSupplierQuoteRequest) {
    const resolvedStatus = resolveExpiredQuoteRequestStatus({ status: request.status, dueDate: request.dueDate });
    if (resolvedStatus !== request.status) {
      return { ...request, status: resolvedStatus } as OpsSupplierQuoteRequest;
    }
    return request;
  }

  private async expireQuoteRequestIfNeeded(request: OpsSupplierQuoteRequest) {
    const requestWithStatus = this.withExpiredQuoteRequestStatus(request);
    if (requestWithStatus.status === request.status) return request;
    return this.prisma.opsSupplierQuoteRequest.update({
      where: { id: request.id },
      data: { status: requestWithStatus.status },
    });
  }
}
