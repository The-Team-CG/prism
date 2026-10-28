import { Inject, Injectable, BadRequestException, ConflictException, ForbiddenException, NotFoundException, Optional, forwardRef } from '@nestjs/common';
import { Prisma, type OpsBillingStatement, type OpsBillingSource } from '@prisma/client';
import { PrismaService } from '@prism/kernel/database';
import { toPrismaJson } from '@prism/kernel/database';
import { createHash, randomUUID } from 'node:crypto';
import { AuditActionType, AuditCategory, OpsUserRole, WorkflowCommandService, type WorkflowCommandDefinition } from '@prism/kernel/event-core';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import { NOTIFICATION_OUTBOX_WRITER, type NotificationOutboxWriter, StorageObjectService, writeNotification } from '@prism/contexts/platform-ops';
import { AUDIT_WRITER, type AuditWriter, writeAudit } from '@prism/kernel/access-control';
import { DOCUMENT_VAULT, type DocumentVault } from '@prism/contexts/event-lifecycle';
import type { PrismVerifiedEventActor } from '@prism/types';
import { validatePaymentTerms } from '../../domain/payment-terms.policy';
import { auditMetadata, billingCommandContext, isoDate, timestamp, addDays, parseDate, requireBillingActor } from './billing-operations.utils';
import { mapBillingSource, mapBillingStatement } from './billing-operations.mappers';
import type {
  ApproveBillingSourceInput,
  BillingActor,
  BillingLineItemInput,
  BillingMethodInput,
  BillingScheduleInput,
  CreateBillingSourceInput,
} from '../../contracts/billing-operations.types';

export function renderBillingPdf(input: { number: string; sourceLabel: string; totalAmount: number }) {
  const text = `P.R.I.S.M BILLING STATEMENT\n${input.number}\nSource: ${input.sourceLabel}\nTotal: ${input.totalAmount}`;
  const body = `BT /F1 12 Tf 72 720 Td (${text.replace(/[()\\]/g, '')}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(body, 'utf8')} >>\nstream\n${body}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf, 'utf8')); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const start = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10, '0')} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  return Buffer.from(pdf, 'utf8');
}

type ProposalEvidenceCheck = { citedProposalVersion?: number; evidenceOverrideReason?: string; totalOverrideReason?: string };

function isIdempotencyKeyViolation(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return false;
  const target = error.meta?.target;
  return Array.isArray(target)
    ? target.some((value) => String(value).toLowerCase().includes('idempotency'))
    : typeof target === 'string' && target.toLowerCase().includes('idempotency');
}

function assertIdempotencyPayload<T extends { payloadHash: string | null }>(record: T, payloadHash: string) {
  if (record.payloadHash && record.payloadHash !== payloadHash) throw new BadRequestException('Idempotency key was reused for different content');
}

async function createIdempotently<T extends { payloadHash: string | null }>(
  key: string | undefined,
  payloadHash: string,
  find: () => Promise<T | null>,
  create: () => Promise<T>,
) {
  if (key) {
    const replay = await find();
    if (replay) {
      assertIdempotencyPayload(replay, payloadHash);
      return { value: replay, replayed: true };
    }
  }
  try {
    return { value: await create(), replayed: false };
  } catch (error) {
    if (!key || !isIdempotencyKeyViolation(error)) throw error;
    const replay = await find();
    if (!replay) throw error;
    assertIdempotencyPayload(replay, payloadHash);
    return { value: replay, replayed: true };
  }
}

@Injectable()
export class BillingOperationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
    @Inject(NOTIFICATION_OUTBOX_WRITER) private readonly notificationOutboxWriter: NotificationOutboxWriter,
    private readonly workflowCommandService: WorkflowCommandService,
    @Inject(DOCUMENT_VAULT) private readonly documentVault: DocumentVault,
    @Optional() @Inject(forwardRef(() => StorageObjectService)) private readonly storageObjectService?: StorageObjectService,
  ) {}

  async createBillingSource(eventId: string, input: CreateBillingSourceInput, actor: BillingActor, transaction?: PrismTransactionContext) {
    actor = requireBillingActor(actor);
    let lineItems: BillingLineItemInput[] = [];
    let totalAmount = 0;
    let paymentSchedule: ReturnType<BillingOperationsService['normalizeBillingSchedule']> = [];
    let paymentMethods: ReturnType<BillingOperationsService['normalizeBillingMethods']> = [];
    let paymentTermsPolicyState = 'standard';
    let paymentTermsOverrideReason: string | null = null;
    let evidenceCheck: ProposalEvidenceCheck = {};
    let replayed = false;
    const payloadHash = createHash('sha256').update(JSON.stringify(input)).digest('hex');

    return this.executeBillingCommand<OpsBillingSource, ReturnType<typeof mapBillingSource>>({
      name: 'create_billing_source',
      eventId,
      context: billingCommandContext(eventId, 'create_billing_source', input.idempotencyKey, actor),
      sideEffectMode: 'same_tx',
      idempotencyPayloadHash: payloadHash,
      validateState: async () => {
        await this.requireEvent(eventId, transaction?.prisma);
        let reference: Awaited<ReturnType<DocumentVault['findEligibleReference']>> | undefined;
        if (input.sourceDocumentId) {
          reference = await this.documentVault.findEligibleReference({
            eventId,
            purpose: 'billing_source_evidence',
            documentId: input.sourceDocumentId,
          });
        }
        lineItems = this.normalizeBillingLineItems(input.lineItems);
        totalAmount = lineItems.reduce((sum, item) => sum + item.amount, 0);
        if (!Number.isSafeInteger(totalAmount) || totalAmount <= 0 || totalAmount > 2147483647) throw new BadRequestException('Billing source total must be a positive whole amount within the supported range');
        // A keyed retry replays the stored source; it is not re-judged against proposals issued since.
        if (reference && !(await this.isKeyedReplay(input.idempotencyKey, transaction?.prisma))) {
          evidenceCheck = await this.checkProposalEvidence(eventId, reference, totalAmount, input, transaction?.prisma);
        }
        paymentSchedule = this.normalizeBillingSchedule(input.paymentSchedule, totalAmount);
        const terms = validatePaymentTerms({ schedule: paymentSchedule, policy: input.paymentTermsPolicy, overrideReason: input.paymentTermsOverrideReason });
        paymentTermsPolicyState = terms.state;
        paymentTermsOverrideReason = terms.overrideReason;
        paymentMethods = this.normalizeBillingMethods(input.paymentMethods);
      },
      validateStateInTransaction: async (context) => {
        if (input.sourceDocumentId) {
          await this.documentVault.findEligibleReference({
            eventId,
            purpose: 'billing_source_evidence',
            documentId: input.sourceDocumentId,
          }, context);
        }
      },
      write: (context) =>
        (async () => {
          const db = context?.prisma ?? this.prisma;
          const result = await createIdempotently(
            input.idempotencyKey,
            payloadHash,
            () => db.opsBillingSource.findUnique({ where: { idempotencyKey: input.idempotencyKey! } }),
            () => db.opsBillingSource.create({
            data: {
              id: `bsrc_${randomUUID()}`,
              eventId,
              sourceType: input.sourceType?.trim() || 'ce_proposal',
              sourceLabel: input.sourceLabel.trim(),
              sourceDocumentId: input.sourceDocumentId ?? null,
              lineItems: toPrismaJson(lineItems),
              paymentSchedule: toPrismaJson(paymentSchedule),
              paymentMethods: toPrismaJson(paymentMethods),
              totalAmount,
              status: 'draft',
              paymentTermsPolicyState,
              paymentTermsOverrideReason,
              payloadHash,
              idempotencyKey: input.idempotencyKey ?? null,
            },
            }),
          );
          replayed = result.replayed;
          return result.value;
        })(),
      sideEffects: async (source, context) => {
        // An enclosing correction records source approval with the replacement invoice after storage succeeds.
        if (replayed || transaction) return;
        await writeAudit(this.auditWriter, eventId, actor.name, `Created billing source: ${source.sourceLabel}`, {
          actorRole: actor.role,
          actorEmail: actor.email,
          actionType: AuditActionType.Create,
          category: AuditCategory.Finance,
          affectedType: 'billing_source',
          affectedId: source.id,
          affectedLabel: source.sourceLabel,
          metadata: auditMetadata(actor, { totalAmount, ...evidenceCheck }),
        }, context);
      },
      project: (source) => mapBillingSource(source),
    }, transaction);
  }

  async approveBillingSource(
    eventId: string,
    sourceId: string,
    input: ApproveBillingSourceInput = {},
    actor: BillingActor,
    transaction?: PrismTransactionContext,
  ) {
    actor = requireBillingActor(actor);
    const approvedBy = actor.name;
    let source: OpsBillingSource | null = null;

    return this.executeBillingCommand<OpsBillingSource, ReturnType<typeof mapBillingSource>>({
      name: 'approve_billing_source',
      eventId,
      validateState: async () => {
        await this.requireEvent(eventId, transaction?.prisma);
        source = await (transaction?.prisma ?? this.prisma).opsBillingSource.findUnique({ where: { id: sourceId } });
        if (!source || source.eventId !== eventId) throw new NotFoundException('Billing source not found');
        // An enclosing correction replaces an already-approved invoice and is governed by the correction flow.
        if (source.status !== 'approved' && !transaction) {
          await this.assertDifferentApproverForTotalOverride(eventId, source, actor);
        }
      },
      write: async (context) => {
        const db = transaction?.prisma ?? context?.prisma ?? this.prisma;
        // The cap is checked under a per-event lock so two simultaneous approvals cannot both fit.
        if (source && source.status !== 'approved' && !transaction) await this.assertWithinIssuedProposalTotal(eventId, source, db);
        const approved = await db.opsBillingSource.updateMany({
          where: { id: sourceId, eventId, status: { not: 'approved' } },
          data: {
            status: 'approved',
            approvedAt: new Date(),
            approvedBy,
            paymentTermsApprovedBy: source?.paymentTermsPolicyState === 'repeat_client_override' ? approvedBy : null,
            approvalNotes: input.approvalNotes?.trim() ?? '',
          },
        });
        if (approved.count !== 1) throw new ConflictException('Billing source is already approved');
        const saved = await db.opsBillingSource.findUnique({ where: { id: sourceId } });
        if (!saved) throw new NotFoundException('Billing source not found');
        return saved;
      },
      sideEffects: async (approvedSource, context) => {
        if (transaction) return;
        await writeAudit(this.auditWriter, eventId, approvedBy, `Approved billing source: ${approvedSource.sourceLabel}`, {
          actorRole: actor.role,
          actorEmail: actor.email,
          actionType: AuditActionType.Approve,
          category: AuditCategory.Finance,
          affectedType: 'billing_source',
          affectedId: approvedSource.id,
          affectedLabel: approvedSource.sourceLabel,
          metadata: auditMetadata(actor, { totalAmount: approvedSource.totalAmount, approvalNotes: input.approvalNotes ?? '' }),
        }, context);
      },
      project: (approvedSource) => mapBillingSource(approvedSource),
    }, transaction);
  }

  async generateBillingStatement(
    eventId: string,
    sourceId: string | undefined,
    actor: BillingActor,
    verifiedActor: PrismVerifiedEventActor,
    idempotencyKey?: string,
    supersedesStatementId?: string,
    transaction?: PrismTransactionContext,
  ) {
    actor = requireBillingActor(actor);
    if (
      verifiedActor.actorId !== actor.id ||
      verifiedActor.actorRole !== actor.role ||
      verifiedActor.actorName !== actor.name ||
      verifiedActor.actorEmail.toLowerCase() !== actor.email?.toLowerCase() ||
      (verifiedActor.eventId && verifiedActor.eventId !== eventId)
    ) {
      throw new ForbiddenException('Verified billing actor does not match the billing command');
    }
    let event: Awaited<ReturnType<BillingOperationsService['requireEvent']>> | null = null;
    let inquiry: Awaited<ReturnType<PrismaService['opsInquiry']['findUnique']>> | null = null;
    let source: OpsBillingSource | null = null;
    let billingNumber = '';
    let lineItems: ReturnType<BillingOperationsService['asBillingLineItems']> = [];
    let paymentSchedule: ReturnType<BillingOperationsService['asBillingSchedule']> = [];
    let paymentMethods: ReturnType<BillingOperationsService['asBillingMethods']> = [];
    let pdfBytes: Uint8Array = new Uint8Array();
    let storageState = 'pending';
    let storageObjectId: string | null = null;
    let storageKey = '';
    let existingStatement: OpsBillingStatement | null = null;
    const statementId = `bill_${randomUUID()}`;
    const payloadHash = createHash('sha256').update(JSON.stringify({ eventId, sourceId: sourceId ?? null })).digest('hex');

    return this.executeBillingCommand<OpsBillingStatement, ReturnType<typeof mapBillingStatement>>({
      name: 'generate_billing_statement',
      eventId,
      context: billingCommandContext(eventId, 'generate_billing_statement', idempotencyKey, actor),
      sideEffectMode: 'same_tx',
      idempotencyPayloadHash: payloadHash,
      validateState: async () => {
        event = await this.requireEvent(eventId, transaction?.prisma);
        inquiry = await (transaction?.prisma ?? this.prisma).opsInquiry.findUnique({ where: { id: event.inquiryId } });
        source = sourceId
          ? await (transaction?.prisma ?? this.prisma).opsBillingSource.findUnique({ where: { id: sourceId } })
          : await (transaction?.prisma ?? this.prisma).opsBillingSource.findFirst({ where: { eventId, status: 'approved' } });

        if (!source || source.eventId !== eventId) throw new NotFoundException('Billing source not found');
        if (source.status !== 'approved') {
          throw new BadRequestException('Billing source must be approved before generating a billing statement');
        }

        lineItems = this.asBillingLineItems(source.lineItems);
        paymentSchedule = this.asBillingSchedule(source.paymentSchedule, source.totalAmount, event.eventDate);
        paymentMethods = this.asBillingMethods(source.paymentMethods);
      },
      write: async (context) => {
        if (!event || !source) throw new NotFoundException('Billing source not found');
        const tx = context?.prisma ?? this.prisma;
        if (idempotencyKey) {
          existingStatement = await tx.opsBillingStatement.findUnique({ where: { idempotencyKey } });
          if (existingStatement) {
            if (existingStatement.payloadHash && existingStatement.payloadHash !== payloadHash) throw new BadRequestException('Billing statement idempotency key was reused for different content');
            return existingStatement;
          }
        }
        // One statement per source; a correction replaces an invoice with a statement from a new source.
        const sourceStatement = await tx.opsBillingStatement.findFirst({ where: { sourceId: source.id }, select: { id: true } });
        if (sourceStatement) throw new ConflictException('A billing statement already exists for this source.');
        billingNumber = await this.allocateBillingNumber(tx, event.eventDate.getFullYear());
        pdfBytes = renderBillingPdf({ number: billingNumber, sourceLabel: source.sourceLabel, totalAmount: source.totalAmount });
        const storage = await this.prepareBillingStatementStorage(eventId, statementId, billingNumber, source, pdfBytes, actor);
        storageState = storage.storageState;
        storageObjectId = storage.storageObjectId;
        storageKey = storage.storageKey;
        const billingDocument = await this.documentVault.registerDocument({
          eventId: event.id,
          documentKind: 'billing_statement',
          logicalTarget: { kind: 'billing_statement', id: statementId },
          fileName: `${billingNumber}.pdf`,
          generatedFileName: `${billingNumber}.pdf`,
          mimeType: 'application/pdf',
          sizeBytes: pdfBytes.byteLength,
          validationStatus: 'accepted',
          storageBucket: 'document-vault',
          storageKey: storageKey || undefined,
          status: storageState === 'stored' ? 'stored' : 'pending_storage',
          verifiedActor,
          idempotencyKey,
        }, context);

        const statement = await tx.opsBillingStatement.create({
          data: {
            id: statementId,
            eventId,
            sourceId: source.id,
            number: billingNumber,
            clientName: inquiry?.clientName ?? event.clientName,
            clientContact: inquiry?.email ?? '',
            eventName: event.eventName,
            eventDate: event.eventDate,
            lineItems: toPrismaJson(lineItems),
            paymentSchedule: toPrismaJson(paymentSchedule),
            paymentMethods: toPrismaJson(paymentMethods),
            totalAmount: source.totalAmount,
            documentId: billingDocument.id,
            pdfUrl: '',
            storageKey,
            storageObjectId,
            storageState,
            idempotencyKey: idempotencyKey ?? null,
            payloadHash,
            status: 'issued',
            supersedesStatementId: supersedesStatementId ?? null,
          },
        });

        const eventDate = event.eventDate;
        await tx.opsPaymentMilestone.createMany({
          data: paymentSchedule.map((item) => ({
            id: `pay_${randomUUID()}`,
            eventId,
            statementId: statement.id,
            label: item.label,
            percentage: item.percentage,
            amount: item.amount,
            amountPaid: 0,
            remainingBalance: item.amount,
            dueDate: parseDate(item.dueDate ?? isoDate(addDays(eventDate, -7))),
            status: 'pending',
          })),
        });
        return statement;
      },
      sideEffects: async (statement, context) => {
        if (existingStatement) return;
        await writeAudit(this.auditWriter, eventId, actor.name, `Generated billing statement ${billingNumber}`, {
          actorRole: actor.role,
          actorEmail: actor.email,
          category: AuditCategory.Finance,
          actionType: AuditActionType.Create,
          affectedType: 'billing_statement',
          affectedId: statement.id,
          affectedLabel: billingNumber,
          metadata: auditMetadata(actor, { sourceId: source?.id, sourceLabel: source?.sourceLabel, totalAmount: source?.totalAmount, notificationStatus: 'not_queued', notificationReason: 'The client is notified when PMCM sends the statement' }),
        }, context);
      },
      project: (statement) => mapBillingStatement(statement),
    }, transaction);
  }

  private async allocateBillingNumber(tx: Prisma.TransactionClient, year: number) {
    // QUERY_AUDIT_RAW_SQL: serialize the one-time yearly sequence bootstrap with statement allocations.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('prism.billing_statement_sequence'), ${year})`;
    // QUERY_AUDIT_RAW_SQL: serialize annual number allocation on the sequence row.
    const sequenceRows = await tx.$queryRaw<Array<{ next_number: number }>>`SELECT "next_number" FROM "commercial"."billing_statement_sequences" WHERE "year" = ${year} FOR UPDATE`;
    let nextNumber = sequenceRows[0]?.next_number;
    if (nextNumber === undefined) {
      // QUERY_AUDIT_RAW_SQL: read legacy statement numbers only when this year has no sequence row.
      const startingNumberRows = await tx.$queryRaw<Array<{ next_number: number }>>`
        SELECT COALESCE(MAX(substring("number" FROM '^BS-[0-9]{4}-([0-9]{4})$')::integer), 0) + 1 AS "next_number"
        FROM "commercial"."billing_statements"
        WHERE "number" ~ ('^BS-' || ${year}::text || '-[0-9]{4}$')
      `;
      nextNumber = startingNumberRows[0]?.next_number ?? 1;
      // QUERY_AUDIT_RAW_SQL: tolerate an older server initializing the row during a rolling deployment.
      await tx.$executeRaw`INSERT INTO "commercial"."billing_statement_sequences" ("year", "next_number") VALUES (${year}, ${nextNumber}) ON CONFLICT ("year") DO NOTHING`;
      // QUERY_AUDIT_RAW_SQL: use whichever transaction won first-time sequence initialization.
      const initializedRows = await tx.$queryRaw<Array<{ next_number: number }>>`SELECT "next_number" FROM "commercial"."billing_statement_sequences" WHERE "year" = ${year} FOR UPDATE`;
      nextNumber = initializedRows[0]?.next_number ?? nextNumber;
    }
    // QUERY_AUDIT_RAW_SQL: advance the locked yearly sequence with the issued statement.
    await tx.$executeRaw`UPDATE "commercial"."billing_statement_sequences" SET "next_number" = ${nextNumber + 1} WHERE "year" = ${year}`;
    return `BS-${year}-${String(nextNumber).padStart(4, '0')}`;
  }

  async sendBillingStatement(eventId: string, billingId: string, actor: BillingActor) {
    actor = requireBillingActor(actor);
    return this.prisma.$transaction(async (tx) => {
      // QUERY_AUDIT_RAW_SQL: share the invoice lock with corrections so an obsolete invoice cannot be resent.
      await tx.$queryRaw`SELECT "id" FROM "commercial"."billing_statements" WHERE "id" = ${billingId} AND "event_id" = ${eventId} FOR UPDATE`;
      const existing = await tx.opsBillingStatement.findUnique({ where: { id: billingId } });
      if (!existing || existing.eventId !== eventId) throw new NotFoundException('Billing statement not found');
      if (existing.status === 'superseded') throw new BadRequestException('A superseded billing statement cannot be sent');
      if (existing.status === 'sent') return mapBillingStatement(existing);
      const billing = await tx.opsBillingStatement.update({ where: { id: billingId }, data: { status: 'sent', sentAt: new Date() } });
      const context: PrismTransactionContext = { prisma: tx, actorId: actor.id, correlationId: `billing-send:${billing.id}` };
      await this.queueSentStatementNotifications(billing, actor, context);
      return mapBillingStatement(billing);
    });
  }

  private async queueSentStatementNotifications(billing: OpsBillingStatement, actor: BillingActor, context: PrismTransactionContext) {
    const recipient = billing.clientContact?.trim();
    await writeAudit(this.auditWriter, billing.eventId, actor.name, `Sent billing statement ${billing.number}`, {
      actorRole: actor.role, actorEmail: actor.email, category: AuditCategory.Finance,
      actionType: AuditActionType.Update, affectedType: 'billing_statement', affectedId: billing.id,
      affectedLabel: billing.number,
      metadata: auditMetadata(actor, { notificationStatus: recipient ? 'queued' : 'not_queued', notificationReason: recipient ? undefined : 'No verified client email address is configured' }),
    }, context);
    if (recipient) for (const channel of ['email', 'viber'] as const) await writeNotification(this.notificationOutboxWriter, billing.eventId, recipient, `Billing statement ${billing.number} sent`, channel, { idempotencyKey: `billing-send:${billing.id}:${channel}` }, context);
    // Milestone due notices go out with the statement: a client is told nothing about a statement they cannot see yet.
    const schedule = Array.isArray(billing.paymentSchedule) ? (billing.paymentSchedule as Array<{ label: string; dueDate?: string }>) : [];
    if (recipient) for (const [index, item] of schedule.entries()) await writeNotification(this.notificationOutboxWriter, billing.eventId, recipient, `${item.label} payment milestone for billing statement ${billing.number} is due ${item.dueDate ?? 'on the agreed date'}`, 'email', { idempotencyKey: `billing-reminder:${billing.id}:${index}` }, context);
  }

  private async executeBillingCommand<TWrite, TResult>(
    definition: WorkflowCommandDefinition<TWrite, TResult>,
    transaction?: PrismTransactionContext,
  ): Promise<TResult> {
    if (!transaction) return this.workflowCommandService.execute(definition);
    await definition.validatePermission?.();
    await definition.validateState?.();
    await definition.validateStateInTransaction?.(transaction);
    const result = await definition.write(transaction);
    await definition.sideEffects?.(result, transaction);
    if (!definition.project) throw new Error('Billing commands require a projection');
    return definition.project(result);
  }

  private async isKeyedReplay(idempotencyKey: string | undefined, db: Prisma.TransactionClient | PrismaService = this.prisma) {
    if (!idempotencyKey) return false;
    return Boolean(await db.opsBillingSource.findUnique({ where: { idempotencyKey }, select: { id: true } }));
  }

  /**
   * A source that cites a proposal version must cite the current one and match its total, unless PMCM records a reason.
   * Only overrides that were actually needed are returned, for the audit entry.
   */
  private async checkProposalEvidence(
    eventId: string,
    reference: { kind: string; fileName: string },
    totalAmount: number,
    input: CreateBillingSourceInput,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<ProposalEvidenceCheck> {
    const versionNumber = reference.kind === 'proposal' ? Number(/^Proposal v(\d+)\b/.exec(reference.fileName)?.[1]) : NaN;
    if (!Number.isInteger(versionNumber)) return {};
    const version = await db.opsProposalVersion.findFirst({ where: { eventId, versionNumber }, select: { status: true, totalAmount: true } });
    if (!version) return {};
    const check: ProposalEvidenceCheck = { citedProposalVersion: versionNumber };
    if (version.status === 'superseded') {
      const reason = input.evidenceOverrideReason?.trim();
      if (!reason) throw new BadRequestException(`Proposal v${versionNumber} has been superseded by a newer version. Cite the latest issued proposal, or give an evidenceOverrideReason to cite this one.`);
      check.evidenceOverrideReason = reason;
    }
    if (version.totalAmount !== totalAmount) {
      const reason = input.totalOverrideReason?.trim();
      if (!reason) throw new BadRequestException(`The source total ${totalAmount} does not match the Proposal v${versionNumber} total ${version.totalAmount}. Match the proposal total, or give a totalOverrideReason; a different PMCM admin must then approve the source.`);
      check.totalOverrideReason = reason;
    }
    return check;
  }

  /** The create audit entry is the record of who created a source and whether its total was overridden. */
  private async assertDifferentApproverForTotalOverride(eventId: string, source: OpsBillingSource, actor: BillingActor) {
    const created = await this.prisma.opsAuditLog.findFirst({
      where: { eventId, affectedType: 'billing_source', affectedId: source.id, actionType: AuditActionType.Create },
      orderBy: { createdAt: 'asc' },
      select: { metadata: true },
    });
    const metadata = created?.metadata;
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return;
    const { totalOverrideReason, actorId } = metadata as { totalOverrideReason?: unknown; actorId?: unknown };
    if (totalOverrideReason && actorId === actor.id) {
      throw new ForbiddenException('A billing source with a total override must be approved by a different PMCM admin than the one who created it');
    }
  }

  /** Approved sources together may not exceed the latest issued proposal; later changes go through additional billing. */
  private async assertWithinIssuedProposalTotal(eventId: string, source: OpsBillingSource, db: Prisma.TransactionClient | PrismaService) {
    // QUERY_AUDIT_RAW_SQL: serialize source approvals per event so the cap sees every committed approval.
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('prism.billing_source_cap'), hashtext(${eventId}))`;
    const proposal = await db.opsProposalVersion.findFirst({
      where: { eventId, status: 'issued' },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true, totalAmount: true },
    });
    if (!proposal) return;
    const approved = await db.opsBillingSource.findMany({
      where: { eventId, status: 'approved', id: { not: source.id } },
      select: { totalAmount: true, billingStatements: { select: { status: true } } },
    });
    // A source whose every statement was replaced by a correction no longer counts toward the cap.
    const committed = approved
      .filter((other) => other.billingStatements.length === 0 || other.billingStatements.some((statement) => statement.status !== 'superseded'))
      .reduce((sum, other) => sum + other.totalAmount, 0);
    const total = committed + source.totalAmount;
    if (total > proposal.totalAmount) {
      throw new BadRequestException(`Approving this source would bring approved billing to ${total}, above the Proposal v${proposal.versionNumber} total of ${proposal.totalAmount}. Changes after approval belong in additional billing.`);
    }
  }

  private async prepareBillingStatementStorage(
    eventId: string,
    statementId: string,
    billingNumber: string,
    source: OpsBillingSource,
    pdfBytes: Uint8Array,
    actor: BillingActor,
  ) {
    if (!this.storageObjectService) return { storageState: 'pending', storageObjectId: null, storageKey: '' };
    const storageActorRole = actor.role === OpsUserRole.System ? OpsUserRole.System : OpsUserRole.PmcmAdmin;
    const stored = await this.storageObjectService.requestUpload({
      eventId,
      ownerRecordType: 'billing_statement',
      ownerRecordId: statementId,
      logicalTarget: `billing-statement:${source.id}`,
      usage: 'event_deliverable',
      fileName: `${billingNumber}.pdf`,
      contentType: 'application/pdf',
      declaredByteSize: pdfBytes.byteLength,
      checksumSha256: createHash('sha256').update(pdfBytes).digest('hex'),
      actor: { id: actor.id, name: actor.name, role: storageActorRole, email: actor.email ?? '', eventId, explicit: true },
    });
    let storageState = stored.object.lifecycleState;
    let storageKey = stored.object.providerObjectKey ?? '';
    if (stored.status === 'ready') {
      const confirmed = await this.storageObjectService.confirmUpload({ objectId: stored.object.id, checksumSha256: stored.object.checksumSha256, byteSize: pdfBytes.byteLength, bytes: pdfBytes, actor: { id: actor.id, name: actor.name, role: storageActorRole, email: actor.email ?? '', eventId, explicit: true } });
      storageState = confirmed.lifecycleState;
      storageKey = confirmed.providerObjectKey ?? storageKey;
    }
    return { storageState, storageObjectId: stored.object.id, storageKey };
  }

  private normalizeBillingLineItems(lineItems: BillingLineItemInput[] = []) {
    const normalized = lineItems
      .map((item) => ({
        label: item.label?.trim() ?? '',
        amount: Number(item.amount),
      }));
    if (normalized.length === 0 || normalized.some((item) => !item.label || !Number.isSafeInteger(item.amount) || item.amount <= 0 || item.amount > 2147483647)) {
      throw new BadRequestException('Every billing source line must have a label and a positive whole amount');
    }
    return normalized;
  }

  private normalizeBillingSchedule(schedule: BillingScheduleInput[] | undefined, totalAmount: number) {
    const source =
      schedule && schedule.length > 0
        ? schedule
        : [
            { label: 'Downpayment', percentage: 50 },
            { label: 'Balance', percentage: 50 },
          ];
    const normalized = source.map((item) => ({
      label: item.label?.trim() || 'Payment',
      percentage: Number(item.percentage),
      amount: Math.round((totalAmount * Number(item.percentage)) / 100),
      dueDate: item.dueDate,
    }));
    const amountTotal = normalized.reduce((sum, item) => sum + item.amount, 0);
    if (normalized.length > 0 && amountTotal !== totalAmount) {
      normalized[normalized.length - 1].amount += totalAmount - amountTotal;
    }
    return normalized;
  }

  private normalizeBillingMethods(methods: BillingMethodInput[] | undefined) {
    const source =
      methods && methods.length > 0
        ? methods
        : [
            { label: 'Bank Transfer', details: 'PMCM corporate bank account' },
            { label: 'GCash', details: 'PMCM finance GCash number' },
            { label: 'Cheque', details: 'Payable to PMCM Events Management' },
          ];
    return source.map((item) => ({
      label: item.label?.trim() || 'Payment method',
      details: item.details?.trim() || 'Coordinate with PMCM finance',
    }));
  }

  private asBillingLineItems(value: unknown) {
    return Array.isArray(value) ? (value as Array<{ label: string; amount: number }>) : [];
  }

  private asBillingSchedule(value: unknown, totalAmount: number, eventDate: Date) {
    const raw = Array.isArray(value) ? (value as Array<{ label: string; percentage: number; amount?: number; dueDate?: string }>) : [];
    const defaulted = raw.length > 0 ? raw : this.normalizeBillingSchedule(undefined, totalAmount);
    return defaulted.map((item, index) => ({
      label: item.label,
      percentage: item.percentage,
      amount: item.amount ?? Math.round((totalAmount * item.percentage) / 100),
      dueDate: item.dueDate ?? isoDate(index === 0 ? new Date() : addDays(eventDate, -7)),
    }));
  }

  private asBillingMethods(value: unknown) {
    return Array.isArray(value) ? (value as Array<{ label: string; details: string }>) : this.normalizeBillingMethods(undefined);
  }

  private async requireEvent(eventId: string, db: Prisma.TransactionClient | PrismaService = this.prisma) {
    const event = await db.opsEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }
}
