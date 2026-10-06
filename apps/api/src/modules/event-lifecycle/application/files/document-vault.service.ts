import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '@prism/kernel/database';
import { validateUploadMetadata } from '@prism/kernel/shared';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import {
  documentKindSchema,
  documentReferenceLookupSchema,
  documentRetentionPolicySchema,
  registerLifecycleDocumentSchema,
  type DocumentReferenceLookup,
  type DocumentRetentionPolicy,
  type PrismDocumentReference,
  type RegisterLifecycleDocumentInput,
} from '@prism/types';
import type {
  DocumentVault,
  UploadMetadataInput,
  UploadValidationOptions,
  ValidatedUploadMetadata,
} from '../../contracts/document-vault.port';

export type { UploadMetadataInput, UploadValidationOptions, ValidatedUploadMetadata } from '../../contracts/document-vault.port';

const PROPOSAL_KINDS = ['proposal', 'ce_proposal', 'briefing_proposal'] as const;
const DOCUMENT_RETENTION_POLICY = documentRetentionPolicySchema.parse({
  status: 'pending_pmcm_policy',
  retentionPeriod: 'Event archive lifetime until PMCM document retention is finalized',
  deletionBehavior: 'Keep metadata unless PMCM executes a document-specific redaction workflow.',
  redactionEnabled: false,
});

@Injectable()
export class DocumentVaultService implements DocumentVault {
  constructor(@Optional() private readonly prisma?: PrismaService) {}

  validateUploadMetadata(
    input: UploadMetadataInput,
    prefix: string,
    options: UploadValidationOptions = {},
  ): ValidatedUploadMetadata {
    return validateUploadMetadata(input, prefix, options);
  }

  async registerDocument(
    input: RegisterLifecycleDocumentInput,
    context?: PrismTransactionContext,
  ): Promise<PrismDocumentReference> {
    const parsed = registerLifecycleDocumentSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException('Invalid lifecycle document metadata');
    const command = parsed.data;
    const { verifiedActor } = command;
    this.assertActorMayRegister(command, verifiedActor);
    const fileName = command.fileName.trim().replace(/^.*[\\/]/, '');
    if (!fileName) throw new BadRequestException('File name is required');
    const db = context?.prisma ?? this.prisma;
    if (!db) throw new Error('Document metadata persistence requires a database transaction or Prisma service');
    const document = await db.opsDocument.create({
      data: {
        id: `doc_${randomUUID()}`,
        eventId: command.eventId,
        type: command.documentKind,
        fileName,
        generatedFileName: command.generatedFileName ?? null,
        status: command.status,
        mimeType: command.mimeType ?? null,
        sizeBytes: command.sizeBytes ?? null,
        validationStatus: command.validationStatus ?? 'accepted',
        storageBucket: command.storageBucket ?? null,
        storageKey: command.storageKey ?? null,
        uploadedByRole: verifiedActor.actorRole,
      },
      select: { id: true, eventId: true, type: true, status: true, fileName: true },
    });

    return {
      id: document.id,
      eventId: document.eventId,
      kind: documentKindSchema.parse(document.type),
      status: document.status,
      fileName: document.fileName,
    };
  }

  private assertActorMayRegister(
    command: { eventId: string; documentKind: string },
    verifiedActor: { eventId?: string | null; actorRole: string; supplierId?: string | null },
  ): void {
    if (verifiedActor.eventId && verifiedActor.eventId !== command.eventId) {
      throw new ForbiddenException('Verified actor is outside the document event scope');
    }
    if (command.documentKind === 'supplier_contract') {
      if (verifiedActor.actorRole !== 'supplier' || !verifiedActor.supplierId) {
        throw new ForbiddenException('A verified supplier is required to register a supplier contract');
      }
    } else if (command.documentKind === 'billing_statement') {
      if (!['pmcm-admin', 'system'].includes(verifiedActor.actorRole)) {
        throw new ForbiddenException('A verified billing actor is required to register a billing statement');
      }
    }
  }

  async findEligibleReference(
    input: DocumentReferenceLookup,
    context?: PrismTransactionContext,
  ): Promise<PrismDocumentReference> {
    const parsed = documentReferenceLookupSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException('Invalid document reference lookup');
    const lookup = parsed.data;
    const proposalEvidence = { type: { in: [...PROPOSAL_KINDS] }, status: 'issued' };
    const eligibleKinds = lookup.purpose === 'client_proposal_review'
      ? [proposalEvidence]
      : [proposalEvidence, { type: 'signed_conforme', status: 'approved' }];
    const db = context?.prisma ?? this.prisma;
    if (!db) throw new Error('Document reference lookup requires a database transaction or Prisma service');
    const document = await db.opsDocument.findFirst({
      where: {
        eventId: lookup.eventId,
        ...(lookup.documentId ? { id: lookup.documentId } : {}),
        OR: eligibleKinds,
      },
      orderBy: [{ uploadedAt: 'desc' }, { id: 'desc' }],
      select: { id: true, eventId: true, type: true, status: true, fileName: true },
    });
    if (!document) throw new NotFoundException('Eligible document not found for this event');

    return {
      id: document.id,
      eventId: document.eventId,
      kind: documentKindSchema.parse(document.type),
      status: document.status,
      fileName: document.fileName,
    };
  }

  getRetentionPolicy(): DocumentRetentionPolicy {
    return DOCUMENT_RETENTION_POLICY;
  }
}
