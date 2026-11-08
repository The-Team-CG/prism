import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { StorageValidationService } from './storage-validation.service';

const bytes = Buffer.from('%PDF-1.7\nsigned conforme bytes');
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
    const webpBytes = Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA', 'base64');
    const webpUpload = { ...logo, byteSize: webpBytes.byteLength, checksumSha256: createHash('sha256').update(webpBytes).digest('hex') };
    expect(service.validateBytes(webpUpload, webpBytes)).toMatchObject({ contentType: 'image/webp' });
    expect(() => service.validateBytes({ ...logo, byteSize: bytes.byteLength, checksumSha256: checksum }, bytes))
      .toThrow(/declared file type/);
    expect(() => service.validateDeclaration({ ...logo, fileName: 'event-logo.svg', contentType: 'image/svg+xml' as const }))
      .toThrow(/not allowed/);
    expect(() => service.validateDeclaration({ ...logo, byteSize: 1_048_577 }))
      .toThrow(/allowed size/);
  });

  it('accepts real leading bytes for every accepted type and rejects a renamed executable or HTML page', () => {
    const zipEntries = (entry: string) => Buffer.concat([
      Buffer.from('PK\u0003\u0004', 'latin1'), Buffer.alloc(26), Buffer.from('[Content_Types].xml'), Buffer.alloc(8), Buffer.from(entry),
    ]);
    const realHeaders: Array<{ usage: 'client_document' | 'guest_feedback_media'; fileName: string; contentType: string; header: Buffer }> = [
      { usage: 'client_document', fileName: 'proposal.pdf', contentType: 'application/pdf', header: Buffer.from('%PDF-1.7\n%\u00e2\u00e3\n', 'latin1') },
      { usage: 'client_document', fileName: 'brief.docx', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', header: zipEntries('word/document.xml') },
      { usage: 'client_document', fileName: 'budget.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', header: zipEntries('xl/workbook.xml') },
      { usage: 'client_document', fileName: 'venue.jpg', contentType: 'image/jpeg', header: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]) },
      { usage: 'client_document', fileName: 'venue.png', contentType: 'image/png', header: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]) },
      { usage: 'guest_feedback_media', fileName: 'clip.mp4', contentType: 'video/mp4', header: Buffer.from('000000186674797069736f6d00000200', 'hex') },
      { usage: 'guest_feedback_media', fileName: 'clip.mov', contentType: 'video/quicktime', header: Buffer.from('00000014667479707174202000000000', 'hex') },
    ];
    const impostors: Array<{ label: string; header: Buffer }> = [
      { label: 'Windows executable', header: Buffer.from('MZ\u0090\u0000\u0003\u0000\u0000\u0000', 'latin1') },
      { label: 'HTML page', header: Buffer.from('<!DOCTYPE html><html><script>alert(1)</script>') },
    ];

    for (const { usage, fileName, contentType, header } of realHeaders) {
      const declaration = { usage, fileName, contentType, byteSize: header.byteLength, checksumSha256: createHash('sha256').update(header).digest('hex') };
      expect(service.validateBytes(declaration, header), fileName).toMatchObject({ contentType });
      for (const impostor of impostors) {
        const renamed = Buffer.concat([impostor.header, Buffer.alloc(64)]);
        const impostorDeclaration = { ...declaration, byteSize: renamed.byteLength, checksumSha256: createHash('sha256').update(renamed).digest('hex') };
        expect(() => service.validateBytes(impostorDeclaration, renamed), `${impostor.label} as ${fileName}`).toThrow(/declared file type/);
      }
    }
  });
});
