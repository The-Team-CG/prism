import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { DocumentVaultService } from './document-vault.service';

describe('DocumentVaultService', () => {
  function createService() {
    const prisma = {
      opsDocument: {
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
          id: data.id as string,
          eventId: data.eventId as string,
          type: data.type as string,
          status: data.status as string,
          fileName: data.fileName as string,
        })),
        findFirst: vi.fn(async () => null),
      },
    };
    return { service: new DocumentVaultService(prisma as never), prisma };
  }

  it('validates upload metadata and generates safe storage keys', () => {
    const { service } = createService();
    const upload = service.validateUploadMetadata(
      {
        fileName: '../Signed Conforme.PDF',
        mimeType: ' APPLICATION/PDF ',
        sizeBytes: 2048,
      },
      '/events/evt_1/documents/',
    );

    expect(upload).toMatchObject({
      originalFileName: 'Signed Conforme.PDF',
      mimeType: 'application/pdf',
      sizeBytes: 2048,
      storageBucket: 'document-vault',
      validationStatus: 'accepted',
    });
    expect(upload.generatedFileName).toMatch(/^[a-f0-9-]+\.pdf$/);
    expect(upload.storageKey).toMatch(/^events\/evt_1\/documents\/[a-f0-9-]+\.pdf$/);
  });

  it('rejects extension and MIME mismatches', () => {
    const { service } = createService();
    expect(() =>
      service.validateUploadMetadata(
        {
          fileName: 'payload.exe',
          mimeType: 'application/pdf',
          sizeBytes: 1024,
        },
        'events/evt_1/documents',
      ),
    ).toThrow(BadRequestException);
  });

  it('enforces caller-specific size limits', () => {
    const { service } = createService();
    expect(() =>
      service.validateUploadMetadata(
        {
          fileName: 'guest-video.mp4',
          mimeType: 'video/mp4',
          sizeBytes: 12 * 1024 * 1024,
        },
        'events/evt_1/guest-feedback',
        { maxSizeBytes: 10 * 1024 * 1024 },
      ),
    ).toThrow('File exceeds allowed size');
  });

  it('registers metadata through the supplied transaction and returns a serializable reference', async () => {
    const { service, prisma } = createService();
    const tx = { opsDocument: { create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
      id: data.id as string,
      eventId: data.eventId as string,
      type: data.type as string,
      status: data.status as string,
      fileName: data.fileName as string,
    })) } };
    const result = await service.registerDocument({
      eventId: 'evt_1',
      documentKind: 'supplier_contract',
      logicalTarget: { kind: 'supplier_quote_request', id: 'qr_1' },
      fileName: '../contract.pdf',
      generatedFileName: 'safe-contract.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 2048,
      validationStatus: 'accepted',
      storageBucket: 'document-vault',
      storageKey: 'events/evt_1/supplier-contracts/safe-contract.pdf',
      status: 'submitted',
      verifiedActor: {
        actorId: 'supplier_user', actorRole: 'supplier', actorEmail: 'supplier@example.test',
        actorName: 'Supplier', supplierId: 'sup_1', eventId: 'evt_1', expiresAt: '2026-10-04T12:00:00.000Z',
      },
      idempotencyKey: 'contract-submit-1',
    }, { prisma: tx as never, correlationId: 'test', actorId: 'supplier_user' });

    expect(result).toMatchObject({ eventId: 'evt_1', kind: 'supplier_contract', status: 'submitted', fileName: 'contract.pdf' });
    expect(tx.opsDocument.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ eventId: 'evt_1', type: 'supplier_contract', uploadedByRole: 'supplier' }),
    }));
    expect(prisma.opsDocument.create).not.toHaveBeenCalled();
  });

  it('rejects a registration when the verified actor role cannot own that document kind', async () => {
    const { service, prisma } = createService();
    await expect(service.registerDocument({
      eventId: 'evt_1',
      documentKind: 'billing_statement',
      logicalTarget: { kind: 'billing_statement', id: 'bill_1' },
      fileName: 'statement.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
      status: 'pending_storage',
      verifiedActor: {
        actorId: 'supplier_user', actorRole: 'supplier', actorEmail: 'supplier@example.test',
        actorName: 'Supplier', supplierId: 'sup_1', expiresAt: '2026-10-04T12:00:00.000Z',
      },
    })).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.opsDocument.create).not.toHaveBeenCalled();
  });

  it('scopes document references to the event and approved purpose-specific kinds', async () => {
    const { service, prisma } = createService();
    await expect(service.findEligibleReference({
      eventId: 'evt_1', purpose: 'billing_source_evidence', documentId: 'doc_wrong_event',
    })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.opsDocument.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        eventId: 'evt_1',
        id: 'doc_wrong_event',
        OR: [
          { type: { in: ['proposal', 'ce_proposal', 'briefing_proposal'] }, status: 'issued' },
          { type: 'signed_conforme', status: 'approved' },
        ],
      }),
    }));
  });

  it('exposes the existing document retention rule as policy-pending and non-destructive', () => {
    const { service } = createService();
    expect(service.getRetentionPolicy()).toEqual({
      status: 'pending_pmcm_policy',
      retentionPeriod: 'Event archive lifetime until PMCM document retention is finalized',
      deletionBehavior: 'Keep metadata unless PMCM executes a document-specific redaction workflow.',
      redactionEnabled: false,
    });
  });
});
