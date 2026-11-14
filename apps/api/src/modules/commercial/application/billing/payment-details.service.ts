import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '@prism/kernel/database';
import { AUDIT_WRITER, EventAccessPolicyService, writeAudit, type AuditWriter, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { AuditActionType, AuditCategory, OpsUserRole } from '@prism/kernel/event-core';
import type { PrismPaymentDetails, PrismPaymentQrImage, PrismVerifiedEventActor, SavePaymentDetailsInput } from '@prism/types';
import {
  PAYMENT_DETAILS_HISTORY_LIMIT,
  describePaymentDetailsChange,
  parseStoredHistory,
  parseStoredMethods,
  qrImageProblem,
  referencedQrImageIds,
  sniffQrImageType,
} from '../../domain/payment-details.policy';

/** The one row that holds PMCM's payment details. */
const ROW_ID = 'pmcm';

type DetailsRow = { methods: Prisma.JsonValue; revision: number; updatedBy: string; updatedAt: Date };

const mapDetails = (row: DetailsRow | null): PrismPaymentDetails => row
  ? { revision: row.revision, methods: parseStoredMethods(row.methods), updatedBy: row.updatedBy || null, updatedAt: row.updatedAt.toISOString() }
  : { revision: 0, methods: [], updatedBy: null, updatedAt: null };

/** PMCM's one set of payment details and the QR images that go with them. Only PMCM finance reads or changes them here. */
@Injectable()
export class PaymentDetailsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: EventAccessPolicyService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
  ) {}

  async read(verified: PrismVerifiedEventActor): Promise<PrismPaymentDetails> {
    await this.requireFinance(verified, 'payment details');
    return mapDetails(await this.prisma.opsPmcmPaymentDetails.findUnique({ where: { id: ROW_ID } }));
  }

  /**
   * Replaces the whole list. The revision the editor loaded must still be current; otherwise nothing is saved and the
   * editor reloads. A save that changes nothing is not a new revision.
   */
  async save(input: SavePaymentDetailsInput, verified: PrismVerifiedEventActor, now = new Date()): Promise<PrismPaymentDetails> {
    const actor = await this.requireFinance(verified, 'payment details');
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'pmcm-payment-details'}, 0))`; // QUERY_AUDIT_RAW_SQL: serializes edits to PMCM's payment details.
      const existing = await tx.opsPmcmPaymentDetails.findUnique({ where: { id: ROW_ID } });
      const revision = existing?.revision ?? 0;
      if (revision !== input.expectedRevision) {
        throw new ConflictException(`PMCM payment details changed${existing?.updatedBy ? ` (last by ${existing.updatedBy})` : ''} since you opened them; reload and try again`);
      }
      await this.requireUploadedImages(tx, referencedQrImageIds(input.methods));
      const before = parseStoredMethods(existing?.methods);
      const changes = describePaymentDetailsChange(before, input.methods);
      if (changes.length === 0) return mapDetails(existing);

      const next = revision + 1;
      const history = [
        ...parseStoredHistory(existing?.history),
        { revision: next, changedBy: actor.name, changedAt: now.toISOString(), changes },
      ].slice(-PAYMENT_DETAILS_HISTORY_LIMIT);
      const data = {
        methods: input.methods as unknown as Prisma.InputJsonArray, revision: next, updatedBy: actor.name,
        history: history as unknown as Prisma.InputJsonArray,
      };
      if (existing) {
        const updated = await tx.opsPmcmPaymentDetails.updateMany({ where: { id: ROW_ID, revision }, data });
        if (updated.count !== 1) throw new ConflictException('PMCM payment details changed since you opened them; reload and try again');
      } else {
        await tx.opsPmcmPaymentDetails.create({ data: { id: ROW_ID, ...data } });
      }
      await writeAudit(this.auditWriter, undefined, actor.name, 'Updated PMCM payment details', {
        actorRole: actor.role, actorEmail: actor.email, actionType: AuditActionType.Update, category: AuditCategory.Finance,
        affectedType: 'pmcm_payment_details', affectedId: ROW_ID, affectedLabel: 'PMCM payment details',
        metadata: { actorId: actor.id, revision: next, changes },
      }, { prisma: tx, actorId: actor.id, correlationId: `pmcm-payment-details:${next}` });
      return mapDetails(await tx.opsPmcmPaymentDetails.findUniqueOrThrow({ where: { id: ROW_ID } }));
    });
  }

  /** Stores a QR image. The same bytes always return the same id, so a retried upload is safe. */
  async uploadQr(bytes: Buffer, contentType: string | undefined, verified: PrismVerifiedEventActor): Promise<PrismPaymentQrImage> {
    const actor = await this.requireFinance(verified, 'payment QR upload');
    const problem = qrImageProblem(bytes, contentType);
    if (problem) throw new BadRequestException(problem);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    return this.prisma.opsPmcmPaymentQrImage.upsert({
      where: { sha256 },
      update: {},
      create: { id: `pqr_${randomUUID()}`, sha256, contentType: sniffQrImageType(bytes) as string, byteSize: bytes.byteLength, bytes: new Uint8Array(bytes), uploadedBy: actor.name },
      select: { id: true, contentType: true, byteSize: true },
    });
  }

  /** A QR image for PMCM's own screen. */
  async readQr(imageId: string, verified: PrismVerifiedEventActor): Promise<{ bytes: Buffer; contentType: string }> {
    await this.requireFinance(verified, 'payment QR');
    const image = await this.prisma.opsPmcmPaymentQrImage.findUnique({ where: { id: imageId }, select: { bytes: true, contentType: true } });
    if (!image) throw new NotFoundException('Payment QR image not found');
    return { bytes: Buffer.from(image.bytes), contentType: image.contentType };
  }

  private async requireUploadedImages(tx: Prisma.TransactionClient, ids: string[]) {
    if (ids.length === 0) return;
    const found = await tx.opsPmcmPaymentQrImage.findMany({ where: { id: { in: ids } }, select: { id: true } });
    if (found.length !== ids.length) throw new BadRequestException('A QR image was not found; upload it again');
  }

  private async requireFinance(verified: PrismVerifiedEventActor, resource: string): Promise<ResolvedEventOpsActor> {
    const actor = this.policy.resolveEventScopedActor(verified);
    await this.policy.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], resource);
    return actor;
  }
}
