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
});
