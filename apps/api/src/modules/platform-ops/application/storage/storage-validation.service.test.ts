import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { StorageValidationService } from './storage-validation.service';

const bytes = Buffer.from('signed conforme bytes');
const checksum = createHash('sha256').update(bytes).digest('hex');

describe('StorageValidationService', () => {
  const service = new StorageValidationService();

  it('validates the declared type, size, extension, and checksum server-side', () => {
    expect(service.validateBytes({
      usage: 'signed_conforme', fileName: 'signed.pdf', contentType: 'application/pdf', byteSize: bytes.byteLength, checksumSha256: checksum,
    }, bytes)).toMatchObject({ contentType: 'application/pdf', byteSize: bytes.byteLength, checksumSha256: checksum });
  });

  it('rejects a checksum mismatch', () => {
    expect(() => service.validateBytes({
      usage: 'signed_conforme', fileName: 'signed.pdf', contentType: 'application/pdf', byteSize: bytes.byteLength, checksumSha256: 'a'.repeat(64),
    }, bytes)).toThrow(/checksum/);
  });

  it('rejects an oversize declaration', () => {
    expect(() => service.validateDeclaration({
      usage: 'signed_conforme', fileName: 'signed.pdf', contentType: 'application/pdf', byteSize: 25 * 1024 * 1024 + 1, checksumSha256: checksum,
    })).toThrow(/allowed size/);
  });

  it('rejects a wrong content type and mismatched extension', () => {
    expect(() => service.validateDeclaration({
      usage: 'signed_conforme', fileName: 'signed.exe', contentType: 'application/pdf', byteSize: bytes.byteLength, checksumSha256: checksum,
    })).toThrow(/extension/);
    expect(() => service.validateDeclaration({
      usage: 'signed_conforme', fileName: 'signed.pdf', contentType: 'image/png', byteSize: bytes.byteLength, checksumSha256: checksum,
    })).toThrow(/not allowed/);
  });
  it('accepts only bounded raster images for game media', () => {
    const image = {
      usage: 'event_game_media' as const,
      fileName: 'clue.png',
      contentType: 'image/png',
      byteSize: 1024,
      checksumSha256: 'a'.repeat(64),
    };

    expect(service.validateDeclaration(image)).toMatchObject({ contentType: 'image/png', byteSize: 1024 });
    expect(() => service.validateDeclaration({ ...image, contentType: 'image/svg+xml' }))
      .toThrow(/not allowed/);
    expect(() => service.validateDeclaration({ ...image, byteSize: 8 * 1024 * 1024 + 1 }))
      .toThrow(/allowed size/);
  });

  it('accepts bounded raster lobby logos but rejects active formats and oversized files', () => {
    const logo = {
      usage: 'event_game_branding' as const,
      fileName: 'event-logo.webp',
      contentType: 'image/webp',
      byteSize: 1024,
      checksumSha256: 'a'.repeat(64),
    };

    expect(service.validateDeclaration(logo)).toMatchObject({ contentType: 'image/webp', byteSize: 1024 });
    expect(() => service.validateDeclaration({ ...logo, fileName: 'event-logo.svg', contentType: 'image/svg+xml' as const }))
      .toThrow(/not allowed/);
    expect(() => service.validateDeclaration({ ...logo, byteSize: 1_048_577 }))
      .toThrow(/allowed size/);
  });
});
