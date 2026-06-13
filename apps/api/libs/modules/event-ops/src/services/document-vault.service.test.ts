import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { DocumentVaultService } from './document-vault.service';

describe('DocumentVaultService', () => {
  const service = new DocumentVaultService();

  it('validates upload metadata and generates safe storage keys', () => {
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
});
