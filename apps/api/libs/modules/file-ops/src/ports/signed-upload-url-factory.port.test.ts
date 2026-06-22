import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { MetadataOnlySignedUploadUrlFactory } from './signed-upload-url-factory.port';

describe('MetadataOnlySignedUploadUrlFactory', () => {
  it('keeps signed upload URLs gated until storage is approved', async () => {
    const factory = new MetadataOnlySignedUploadUrlFactory();

    await expect(
      factory.createSignedUploadUrl({
        eventId: 'evt_file',
        actorRole: 'pmcm-admin',
        prefix: 'events/evt_file/documents',
        upload: { fileName: 'brief.pdf', mimeType: 'application/pdf', sizeBytes: 1024 },
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});