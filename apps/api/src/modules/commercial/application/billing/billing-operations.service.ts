import { Inject, Injectable, BadRequestException, NotFoundException, Optional } from '@nestjs/common';
import { Prisma, type OpsAdditionalBilling, type OpsBillingCorrection, type OpsBillingDispute, type OpsBillingStatement, type OpsBillingSource } from '@prisma/client';
import { PrismaService } from '@prism/kernel/database';
import { toPrismaJson } from '@prism/kernel/database';
import { createHash, randomUUID } from 'node:crypto';
import { AuditActionType, AuditCategory, OpsUserRole, WorkflowCommandService } from '@prism/kernel/event-core';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import { NOTIFICATION_OUTBOX_WRITER, type NotificationOutboxWriter, StorageObjectService, writeNotification } from '@prism/contexts/platform-ops';
import { AUDIT_WRITER, type AuditWriter, writeAudit } from '@prism/kernel/access-control';
import { validatePaymentTerms } from '../../domain/payment-terms.policy';
import { auditMetadata, billingCommandContext, isoDate, timestamp, addDays, parseDate, requireBillingActor } from './billing-operations.utils';
import { mapAdditionalBilling, mapBillingCorrection, mapBillingDispute, mapBillingSource, mapBillingStatement } from './billing-operations.mappers';
import type {
  ApproveBillingSourceInput,
  BillingActor,
  BillingLineItemInput,
  BillingMethodInput,
  BillingScheduleInput,
  CreateBillingSourceInput,
  RequestBillingCorrectionInput,
  ResolveBillingCorrectionInput,
  CreateBillingDisputeInput,
  ResolveBillingDisputeInput,
  CreateAdditionalBillingInput,
  WaiveAdditionalBillingInput,
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
    @Optional() private readonly storageObjectService?: StorageObjectService,
  ) {}

  async createBillingSource(eventId: string, input: CreateBillingSourceInput, actor: BillingActor) {
    actor = requireBillingActor(actor);
    let lineItems: BillingLineItemInput[] = [];
    let totalAmount = 0;
    let paymentSchedule: ReturnType<BillingOperationsService['normalizeBillingSchedule']> = [];
    let paymentMethods: ReturnType<BillingOperationsService['normalizeBillingMethods']> = [];
    let paymentTermsPolicyState = 'standard';
    let paymentTermsOverrideReason: string | null = null;
    let replayed = false;
    const payloadHash = createHash('sha256').update(JSON.stringify(input)).digest('hex');

    return this.workflowCommandService.execute<OpsBillingSource, ReturnType<typeof mapBillingSource>>({
      name: 'create_billing_source',
      eventId,
      context: billingCommandContext(eventId, 'create_billing_source', input.idempotencyKey, actor),
      sideEffectMode: 'same_tx',
      idempotencyPayloadHash: payloadHash,
      validateState: async () => {
        await this.requireEvent(eventId);
        lineItems = this.normalizeBillingLineItems(input.lineItems);
        totalAmount = lineItems.reduce((sum, item) => sum + item.amount, 0);
        if (totalAmount <= 0) throw new BadRequestException('Billing source total must be greater than zero');
        paymentSchedule = this.normalizeBillingSchedule(input.paymentSchedule, totalAmount);
        const terms = validatePaymentTerms({ schedule: paymentSchedule, policy: input.paymentTermsPolicy, overrideReason: input.paymentTermsOverrideReason });
        paymentTermsPolicyState = terms.state;
        paymentTermsOverrideReason = terms.overrideReason;
        paymentMethods = this.normalizeBillingMethods(input.paymentMethods);
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
      sideEffects: async (source) => {
        if (replayed) return;
        await writeAudit(this.auditWriter, eventId, actor.name, `Created billing source: ${source.sourceLabel}`, {
          actorRole: actor.role,
          actorEmail: actor.email,
          actionType: AuditActionType.Create,
          category: AuditCategory.Finance,
          affectedType: 'billing_source',
          affectedId: source.id,
          affectedLabel: source.sourceLabel,
          metadata: auditMetadata(actor, { totalAmount }),
        });
      },
      project: (source) => mapBillingSource(source),
    });
  }

  async approveBillingSource(
    eventId: string,
    sourceId: string,
    input: ApproveBillingSourceInput = {},
    actor: BillingActor,
  ) {
    actor = requireBillingActor(actor);
    const approvedBy = actor.name;
    let source: OpsBillingSource | null = null;

    return this.workflowCommandService.execute<OpsBillingSource, ReturnType<typeof mapBillingSource>>({
      name: 'approve_billing_source',
      eventId,
      validateState: async () => {
        await this.requireEvent(eventId);
        source = await this.prisma.opsBillingSource.findUnique({ where: { id: sourceId } });
        if (!source || source.eventId !== eventId) throw new NotFoundException('Billing source not found');
      },
      write: () =>
        this.prisma.opsBillingSource.update({
          where: { id: sourceId },
          data: {
            status: 'approved',
            approvedAt: new Date(),
            approvedBy,
            paymentTermsApprovedBy: source?.paymentTermsPolicyState === 'repeat_client_override' ? approvedBy : null,
            approvalNotes: input.approvalNotes?.trim() ?? '',
          },
        }),
      sideEffects: async (approvedSource) => {
        await writeAudit(this.auditWriter, eventId, approvedBy, `Approved billing source: ${approvedSource.sourceLabel}`, {
          actorRole: actor.role,
          actorEmail: actor.email,
          actionType: AuditActionType.Approve,
          category: AuditCategory.Finance,
          affectedType: 'billing_source',
          affectedId: approvedSource.id,
          affectedLabel: approvedSource.sourceLabel,
          metadata: auditMetadata(actor, { totalAmount: approvedSource.totalAmount, approvalNotes: input.approvalNotes ?? '' }),
        });
      },
      project: (approvedSource) => mapBillingSource(approvedSource),
    });
  }

  async generateBillingStatement(eventId: string, sourceId: string | undefined, actor: BillingActor, idempotencyKey?: string) {
    actor = requireBillingActor(actor);
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

    return this.workflowCommandService.execute<OpsBillingStatement, ReturnType<typeof mapBillingStatement>>({
      name: 'generate_billing_statement',
      eventId,
      validateState: async () => {
        event = await this.requireEvent(eventId);
        inquiry = await this.prisma.opsInquiry.findUnique({ where: { id: event.inquiryId } });
        source = sourceId
          ? await this.prisma.opsBillingSource.findUnique({ where: { id: sourceId } })
          : await this.prisma.opsBillingSource.findFirst({ where: { eventId, status: 'approved' } });

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

        return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          if (idempotencyKey) {
            existingStatement = await tx.opsBillingStatement.findUnique({ where: { idempotencyKey } });
            if (existingStatement) {
              if (existingStatement.payloadHash && existingStatement.payloadHash !== payloadHash) throw new BadRequestException('Billing statement idempotency key was reused for different content');
              return existingStatement;
            }
          }
          const billingYear = event!.eventDate.getFullYear();
          // QUERY_AUDIT_RAW_SQL: serialize the one-time yearly sequence bootstrap with statement allocations.
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('prism.billing_statement_sequence'), ${billingYear})`;
          // QUERY_AUDIT_RAW_SQL: serialize annual number allocation on the sequence row.
          const sequenceRows = await tx.$queryRaw<Array<{ next_number: number }>>`SELECT "next_number" FROM "finance_ops"."billing_statement_sequences" WHERE "year" = ${billingYear} FOR UPDATE`;
          let nextNumber = sequenceRows[0]?.next_number;
          if (nextNumber === undefined) {
            // QUERY_AUDIT_RAW_SQL: read legacy statement numbers only when this year has no sequence row.
            const startingNumberRows = await tx.$queryRaw<Array<{ next_number: number }>>`
              SELECT COALESCE(MAX(substring("number" FROM '^BS-[0-9]{4}-([0-9]{4})$')::integer), 0) + 1 AS "next_number"
              FROM "finance_ops"."billing_statements"
              WHERE "number" ~ ('^BS-' || ${billingYear}::text || '-[0-9]{4}$')
            `;
            nextNumber = startingNumberRows[0]?.next_number ?? 1;
            // QUERY_AUDIT_RAW_SQL: tolerate an older server initializing the row during a rolling deployment.
            await tx.$executeRaw`INSERT INTO "finance_ops"."billing_statement_sequences" ("year", "next_number") VALUES (${billingYear}, ${nextNumber}) ON CONFLICT ("year") DO NOTHING`;
            // QUERY_AUDIT_RAW_SQL: use whichever transaction won first-time sequence initialization.
            const initializedRows = await tx.$queryRaw<Array<{ next_number: number }>>`SELECT "next_number" FROM "finance_ops"."billing_statement_sequences" WHERE "year" = ${billingYear} FOR UPDATE`;
            nextNumber = initializedRows[0]?.next_number ?? nextNumber;
          }
          billingNumber = `BS-${billingYear}-${String(nextNumber).padStart(4, '0')}`;
          // QUERY_AUDIT_RAW_SQL: advance the locked yearly sequence with the issued statement.
          await tx.$executeRaw`UPDATE "finance_ops"."billing_statement_sequences" SET "next_number" = ${nextNumber + 1} WHERE "year" = ${billingYear}`;
          pdfBytes = renderBillingPdf({ number: billingNumber, sourceLabel: source!.sourceLabel, totalAmount: source!.totalAmount });
          const storage = await this.prepareBillingStatementStorage(eventId, statementId, billingNumber, source!, pdfBytes, actor);
          storageState = storage.storageState;
          storageObjectId = storage.storageObjectId;
          storageKey = storage.storageKey;
          const billingDocument = await tx.opsDocument.create({
            data: {
              id: `doc_${randomUUID()}`,
              eventId: event!.id,
              type: 'billing_statement',
              fileName: `${billingNumber}.pdf`,
              status: storageState === 'stored' ? 'stored' : 'pending_storage',
              mimeType: 'application/pdf',
              storageBucket: 'document-vault',
              storageKey: storageKey || null,
              sizeBytes: pdfBytes.byteLength || null,
              uploadedByRole: 'system',
            },
          });

          const statement = await tx.opsBillingStatement.create({
            data: {
              id: statementId,
              eventId,
              sourceId: source!.id,
              number: billingNumber,
              clientName: inquiry?.clientName ?? event!.clientName,
              clientContact: inquiry?.email ?? '',
              eventName: event!.eventName,
              eventDate: event!.eventDate,
              lineItems: toPrismaJson(lineItems),
              paymentSchedule: toPrismaJson(paymentSchedule),
              paymentMethods: toPrismaJson(paymentMethods),
              totalAmount: source!.totalAmount,
              documentId: billingDocument.id,
              pdfUrl: '',
              storageKey,
              storageObjectId,
              storageState,
              idempotencyKey: idempotencyKey ?? null,
              payloadHash,
              status: 'issued',
            },
          });

          await tx.opsPaymentMilestone.createMany({
            data: paymentSchedule.map((item) => ({
              id: `pay_${randomUUID()}`,
              eventId,
              label: item.label,
              percentage: item.percentage,
              amount: item.amount,
              amountPaid: 0,
              remainingBalance: item.amount,
              dueDate: parseDate(item.dueDate ?? isoDate(addDays(event!.eventDate, -7))),
              status: 'pending',
            })),
          });

          return statement;
        });
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
          metadata: auditMetadata(actor, { sourceId: source?.id, sourceLabel: source?.sourceLabel, totalAmount: source?.totalAmount, notificationStatus: inquiry?.email?.trim() ? 'queued' : 'not_queued', notificationReason: inquiry?.email?.trim() ? undefined : 'No verified client email address is configured' }),
        }, context);
        const recipient = inquiry?.email?.trim();
        if (recipient) await Promise.all(paymentSchedule.map((item, index) => writeNotification(
            this.notificationOutboxWriter,
            eventId,
            recipient,
            `${item.label} payment milestone for billing statement ${billingNumber} is due ${item.dueDate ?? 'on the agreed date'}`,
            'email',
            { idempotencyKey: `billing-reminder:${statement.id}:${index}` },
            context,
          )));
      },
      project: (statement) => mapBillingStatement(statement),
    });
  }

  async sendBillingStatement(eventId: string, billingId: string, actor: BillingActor) {
    actor = requireBillingActor(actor);
    return this.workflowCommandService.execute<OpsBillingStatement, ReturnType<typeof mapBillingStatement>>({
      name: 'send_billing_statement',
      eventId,
      validateState: async () => {
        await this.requireEvent(eventId);
        const existing = await this.prisma.opsBillingStatement.findUnique({ where: { id: billingId } });
        if (!existing || existing.eventId !== eventId) throw new NotFoundException('Billing statement not found');
      },
      write: () =>
        this.prisma.opsBillingStatement.update({
          where: { id: billingId },
          data: { status: 'sent', sentAt: new Date() },
        }),
      sideEffects: async (billing) => {
        const recipient = billing.clientContact?.trim();
        await Promise.all([
          writeAudit(this.auditWriter, eventId, actor.name, `Sent billing statement ${billing.number}`, {
            actorRole: actor.role,
            actorEmail: actor.email,
            category: AuditCategory.Finance,
            actionType: AuditActionType.Update,
            affectedType: 'billing_statement',
            affectedId: billing.id,
            affectedLabel: billing.number,
            metadata: auditMetadata(actor, { notificationStatus: recipient ? 'queued' : 'not_queued', notificationReason: recipient ? undefined : 'No verified client email address is configured' }),
          }),
          ...(recipient ? [
            writeNotification(this.notificationOutboxWriter, eventId, recipient, `Billing statement ${billing.number} sent`, 'email'),
            writeNotification(this.notificationOutboxWriter, eventId, recipient, `Billing statement ${billing.number} sent`, 'viber'),
          ] : []),
        ]);
      },
      project: (billing) => mapBillingStatement(billing),
    });
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

  async requestBillingCorrection(eventId: string, input: RequestBillingCorrectionInput, actor: BillingActor) {
    actor = requireBillingActor(actor);
    const payloadHash = createHash('sha256').update(JSON.stringify({ eventId, ...input })).digest('hex');
    let statement: OpsBillingStatement | null = null;
    let replayed = false;
    return this.workflowCommandService.execute<OpsBillingCorrection, ReturnType<typeof mapBillingCorrection>>({
      name: 'request_billing_correction', eventId, sideEffectMode: 'same_tx',
      context: billingCommandContext(eventId, 'request_billing_correction', input.idempotencyKey, actor),
      idempotencyPayloadHash: payloadHash,
      validateState: async () => {
        await this.requireEvent(eventId);
        statement = await this.prisma.opsBillingStatement.findUnique({ where: { id: input.statementId } });
        if (!statement || statement.eventId !== eventId) throw new NotFoundException('Billing statement not found');
      },
      write: async (context) => {
        const db = context?.prisma ?? this.prisma;
        const replay = await db.opsBillingCorrection.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
        if (replay) {
          if (replay.payloadHash !== payloadHash) throw new BadRequestException('Billing correction idempotency key was reused for different content');
          replayed = true;
          return replay;
        }
        return db.opsBillingCorrection.create({ data: { id: `corr_${randomUUID()}`, eventId, statementId: statement!.id, reason: input.reason.trim(), correctedTotalAmount: input.correctedTotalAmount ?? null, status: 'pending', requestedBy: actor.name, idempotencyKey: input.idempotencyKey, payloadHash } });
      },
      sideEffects: async (correction, context) => { if (replayed) return; await writeAudit(this.auditWriter, eventId, actor.name, `Requested billing correction for ${statement!.number}`, { actorRole: actor.role, actorEmail: actor.email, category: AuditCategory.Finance, actionType: AuditActionType.Create, affectedType: 'billing_correction', affectedId: correction.id, affectedLabel: statement!.number, metadata: auditMetadata(actor, { statementId: statement!.id, reason: input.reason, correctedTotalAmount: input.correctedTotalAmount ?? null }) }, context); },
      project: (correction) => mapBillingCorrection(correction),
    });
  }

  async resolveBillingCorrection(eventId: string, correctionId: string, input: ResolveBillingCorrectionInput, actor: BillingActor) {
    actor = requireBillingActor(actor);
    let correction: OpsBillingCorrection | null = null;
    return this.workflowCommandService.execute<OpsBillingCorrection, ReturnType<typeof mapBillingCorrection>>({
      name: 'resolve_billing_correction', eventId, sideEffectMode: 'same_tx',
      validateState: async () => {
        await this.requireEvent(eventId);
        correction = await this.prisma.opsBillingCorrection.findUnique({ where: { id: correctionId } });
        if (!correction || correction.eventId !== eventId) throw new NotFoundException('Billing correction not found');
        if (correction.status !== 'pending') throw new BadRequestException('Billing correction has already been resolved');
      },
      write: (context) => (context?.prisma ?? this.prisma).opsBillingCorrection.update({ where: { id: correctionId }, data: { status: input.action === 'approve' ? 'approved' : 'rejected', resolvedBy: actor.name, resolutionNotes: input.resolutionNotes?.trim() ?? null, resolvedAt: new Date() } }),
      sideEffects: async (resolved, context) => { await writeAudit(this.auditWriter, eventId, actor.name, `${input.action === 'approve' ? 'Approved' : 'Rejected'} billing correction`, { actorRole: actor.role, actorEmail: actor.email, category: AuditCategory.Finance, actionType: input.action === 'approve' ? AuditActionType.Approve : AuditActionType.Update, affectedType: 'billing_correction', affectedId: resolved.id, affectedLabel: resolved.statementId, metadata: auditMetadata(actor, { resolutionNotes: input.resolutionNotes ?? '' }) }, context); },
      project: (resolved) => mapBillingCorrection(resolved),
    });
  }

  async createBillingDispute(eventId: string, input: CreateBillingDisputeInput, actor: BillingActor) {
    actor = requireBillingActor(actor);
    const payloadHash = createHash('sha256').update(JSON.stringify({ eventId, ...input })).digest('hex');
    let statement: OpsBillingStatement | null = null;
    let replayed = false;
    return this.workflowCommandService.execute<OpsBillingDispute, ReturnType<typeof mapBillingDispute>>({
      name: 'create_billing_dispute', eventId, sideEffectMode: 'same_tx',
      context: billingCommandContext(eventId, 'create_billing_dispute', input.idempotencyKey, actor),
      idempotencyPayloadHash: payloadHash,
      validateState: async () => {
        await this.requireEvent(eventId);
        statement = await this.prisma.opsBillingStatement.findUnique({ where: { id: input.statementId } });
        if (!statement || statement.eventId !== eventId) throw new NotFoundException('Billing statement not found');
        if (input.amount > statement.totalAmount) throw new BadRequestException('Dispute amount cannot exceed the statement total');
        if (input.milestoneId) {
          const milestone = await this.prisma.opsPaymentMilestone.findUnique({ where: { id: input.milestoneId } });
          if (!milestone || milestone.eventId !== eventId) throw new NotFoundException('Payment milestone not found');
        }
      },
      write: async (context) => {
        const db = context?.prisma ?? this.prisma;
        const replay = await db.opsBillingDispute.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
        if (replay) {
          if (replay.payloadHash !== payloadHash) throw new BadRequestException('Billing dispute idempotency key was reused for different content');
          replayed = true;
          return replay;
        }
        return db.opsBillingDispute.create({ data: { id: `dispute_${randomUUID()}`, eventId, statementId: statement!.id, milestoneId: input.milestoneId ?? null, amount: input.amount, reason: input.reason.trim(), status: 'open', raisedBy: actor.name, idempotencyKey: input.idempotencyKey, payloadHash } });
      },
      sideEffects: async (dispute, context) => { if (replayed) return; await writeAudit(this.auditWriter, eventId, actor.name, `Opened billing dispute for ${statement!.number}`, { actorRole: actor.role, actorEmail: actor.email, category: AuditCategory.Finance, actionType: AuditActionType.Create, affectedType: 'billing_dispute', affectedId: dispute.id, affectedLabel: statement!.number, metadata: auditMetadata(actor, { amount: input.amount, reason: input.reason }) }, context); },
      project: (dispute) => mapBillingDispute(dispute),
    });
  }

  async resolveBillingDispute(eventId: string, disputeId: string, input: ResolveBillingDisputeInput, actor: BillingActor) {
    actor = requireBillingActor(actor);
    return this.workflowCommandService.execute<OpsBillingDispute, ReturnType<typeof mapBillingDispute>>({
      name: 'resolve_billing_dispute', eventId, sideEffectMode: 'same_tx',
      validateState: async () => {
        await this.requireEvent(eventId);
        const dispute = await this.prisma.opsBillingDispute.findUnique({ where: { id: disputeId } });
        if (!dispute || dispute.eventId !== eventId) throw new NotFoundException('Billing dispute not found');
        if (dispute.status !== 'open') throw new BadRequestException('Billing dispute has already been resolved');
      },
      write: (context) => (context?.prisma ?? this.prisma).opsBillingDispute.update({ where: { id: disputeId }, data: { status: input.action === 'resolve' ? 'resolved' : 'rejected', resolvedBy: actor.name, resolutionNotes: input.resolutionNotes.trim(), resolvedAt: new Date() } }),
      sideEffects: async (dispute, context) => { await writeAudit(this.auditWriter, eventId, actor.name, `Resolved billing dispute`, { actorRole: actor.role, actorEmail: actor.email, category: AuditCategory.Finance, actionType: AuditActionType.Update, affectedType: 'billing_dispute', affectedId: dispute.id, affectedLabel: dispute.statementId, metadata: auditMetadata(actor, { resolution: input.action, resolutionNotes: input.resolutionNotes }) }, context); },
      project: (dispute) => mapBillingDispute(dispute),
    });
  }

  async createAdditionalBilling(eventId: string, input: CreateAdditionalBillingInput, actor: BillingActor) {
    actor = requireBillingActor(actor);
    const payloadHash = createHash('sha256').update(JSON.stringify({ eventId, ...input })).digest('hex');
    let event: Awaited<ReturnType<BillingOperationsService['requireEvent']>> | null = null;
    let issue: { id: string; eventId: string } | null = null;
    let replayed = false;
    return this.workflowCommandService.execute<OpsAdditionalBilling, ReturnType<typeof mapAdditionalBilling>>({
      name: 'create_additional_billing', eventId, sideEffectMode: 'same_tx',
      context: billingCommandContext(eventId, 'create_additional_billing', input.idempotencyKey, actor),
      idempotencyPayloadHash: payloadHash,
      validateState: async () => {
        event = await this.requireEvent(eventId);
        if (!event.actualEndedAt) throw new BadRequestException('Post-event additional billing requires a recorded event end');
        issue = await this.prisma.opsUrgentIssue.findUnique({ where: { id: input.urgentIssueId }, select: { id: true, eventId: true } });
        if (!issue || issue.eventId !== eventId) throw new NotFoundException('Urgent issue not found');
      },
      write: async (context) => {
        const db = context?.prisma ?? this.prisma;
        const replay = await db.opsAdditionalBilling.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
        if (replay) {
          if (replay.payloadHash !== payloadHash) throw new BadRequestException('Additional billing idempotency key was reused for different content');
          replayed = true;
          return replay;
        }
        return db.opsAdditionalBilling.create({ data: { id: `addbill_${randomUUID()}`, eventId, urgentIssueId: issue!.id, description: input.description.trim(), amount: input.amount, status: 'issued', createdBy: actor.name, idempotencyKey: input.idempotencyKey, payloadHash } });
      },
      sideEffects: async (billing, context) => { if (replayed) return; await writeAudit(this.auditWriter, eventId, actor.name, `Issued post-event additional billing`, { actorRole: actor.role, actorEmail: actor.email, category: AuditCategory.Finance, actionType: AuditActionType.Create, affectedType: 'additional_billing', affectedId: billing.id, affectedLabel: input.description, metadata: auditMetadata(actor, { urgentIssueId: issue!.id, amount: input.amount }) }, context); },
      project: (billing) => mapAdditionalBilling(billing),
    });
  }

  async waiveAdditionalBilling(eventId: string, additionalBillingId: string, input: WaiveAdditionalBillingInput, actor: BillingActor) {
    actor = requireBillingActor(actor);
    return this.workflowCommandService.execute<OpsAdditionalBilling, ReturnType<typeof mapAdditionalBilling>>({
      name: 'waive_additional_billing', eventId, sideEffectMode: 'same_tx',
      validateState: async () => {
        await this.requireEvent(eventId);
        const billing = await this.prisma.opsAdditionalBilling.findUnique({ where: { id: additionalBillingId } });
        if (!billing || billing.eventId !== eventId) throw new NotFoundException('Additional billing not found');
        if (billing.status !== 'issued') throw new BadRequestException('Only an issued additional bill can be waived');
      },
      write: (context) => (context?.prisma ?? this.prisma).opsAdditionalBilling.update({ where: { id: additionalBillingId }, data: { status: 'waived', waiverReason: input.reason.trim(), waivedBy: actor.name, waivedAt: new Date() } }),
      sideEffects: async (billing, context) => { await writeAudit(this.auditWriter, eventId, actor.name, `Waived post-event additional billing`, { actorRole: actor.role, actorEmail: actor.email, category: AuditCategory.Finance, actionType: AuditActionType.Update, affectedType: 'additional_billing', affectedId: billing.id, affectedLabel: billing.description, metadata: auditMetadata(actor, { waiverReason: input.reason }) }, context); },
      project: (billing) => mapAdditionalBilling(billing),
    });
  }

  private normalizeBillingLineItems(lineItems: BillingLineItemInput[] = []) {
    const normalized = lineItems
      .map((item) => ({
        label: item.label?.trim() ?? '',
        amount: Number(item.amount),
      }))
      .filter((item) => item.label && Number.isFinite(item.amount) && item.amount > 0);
    if (normalized.length === 0) throw new BadRequestException('At least one billing source line item is required');
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

  private async requireEvent(eventId: string) {
    const event = await this.prisma.opsEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }
}
