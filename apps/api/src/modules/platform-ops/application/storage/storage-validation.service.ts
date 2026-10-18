import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { StorageUsage } from '@prism/types';

export type StorageValidationInput = {
  fileName: string;
  contentType: string;
  byteSize: number;
  usage: StorageUsage;
  checksumSha256: string;
};

export type StorageUsageRule = {
  maxBytes: number;
  contentTypes: readonly string[];
};

/** Catalog-backed usage policy. Keep this table server-side; client hints are advisory only. */
export const STORAGE_USAGE_RULES: Record<StorageUsage, StorageUsageRule> = {
  signed_conforme: {
    maxBytes: 25 * 1024 * 1024,
    contentTypes: ['application/pdf'],
  },
  client_document: {
    maxBytes: 25 * 1024 * 1024,
    contentTypes: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
    ],
  },
  supplier_document: {
    maxBytes: 25 * 1024 * 1024,
    contentTypes: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
  },
  guest_feedback_media: {
    maxBytes: 100 * 1024 * 1024,
    contentTypes: ['image/jpeg', 'image/png', 'video/mp4', 'video/quicktime'],
  },
  event_deliverable: {
    maxBytes: 250 * 1024 * 1024,
    contentTypes: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
      'video/mp4',
      'video/quicktime',
    ],
  },
  event_game_media: {
    maxBytes: 8 * 1024 * 1024,
    contentTypes: ['image/jpeg', 'image/png'],
  },
  event_game_branding: {
    maxBytes: 1024 * 1024,
    contentTypes: ['image/jpeg', 'image/png', 'image/webp'],
  },
};

const EXTENSIONS: Record<string, readonly string[]> = {
  'application/pdf': ['pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
  'video/mp4': ['mp4'],
  'video/quicktime': ['mov'],
};

function normalizedFileName(fileName: string) {
  const clean = fileName.trim().replace(/^.*[\\/]/, '');
  if (!clean || clean === '.' || clean === '..') throw new BadRequestException('File name is required');
  return clean;
}

function normalizedChecksum(checksum: string) {
  const value = checksum.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(value)) throw new BadRequestException('A SHA-256 checksum is required');
  return value;
}

function startsWithAscii(bytes: Uint8Array, value: string, offset = 0) {
  if (bytes.byteLength < offset + value.length) return false;
  for (let index = 0; index < value.length; index += 1) {
    if (bytes[offset + index] !== value.charCodeAt(index)) return false;
  }
  return true;
}

function containsAscii(bytes: Uint8Array, value: string) {
  const first = value.charCodeAt(0);
  for (let offset = 0; offset <= bytes.byteLength - value.length; offset += 1) {
    if (bytes[offset] !== first) continue;
    if (startsWithAscii(bytes, value, offset)) return true;
  }
  return false;
}

function hasPdfSignature(bytes: Uint8Array) { return startsWithAscii(bytes, '%PDF-'); }
function hasPngSignature(bytes: Uint8Array) { return [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte); }
function hasJpegSignature(bytes: Uint8Array) { return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff; }
function hasWebpSignature(bytes: Uint8Array) { return startsWithAscii(bytes, 'RIFF') && startsWithAscii(bytes, 'WEBP', 8); }
function hasVideoSignature(bytes: Uint8Array, quicktime: boolean) {
  if (!startsWithAscii(bytes, 'ftyp', 4)) return false;
  const brand = String.fromCharCode(...bytes.subarray(8, 12));
  return quicktime ? brand === 'qt  ' : brand !== 'qt  ';
}
function hasDocxSignature(bytes: Uint8Array) {
  return startsWithAscii(bytes, 'PK\u0003\u0004') && containsAscii(bytes, 'word/document.xml') && containsAscii(bytes, '[Content_Types].xml');
}
function hasXlsxSignature(bytes: Uint8Array) {
  return startsWithAscii(bytes, 'PK\u0003\u0004') && containsAscii(bytes, 'xl/workbook.xml') && containsAscii(bytes, '[Content_Types].xml');
}

const FILE_SIGNATURES: Record<string, (bytes: Uint8Array) => boolean> = {
  'application/pdf': hasPdfSignature,
  'image/png': hasPngSignature,
  'image/jpeg': hasJpegSignature,
  'image/webp': hasWebpSignature,
  'video/mp4': (bytes) => hasVideoSignature(bytes, false),
  'video/quicktime': (bytes) => hasVideoSignature(bytes, true),
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': hasDocxSignature,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': hasXlsxSignature,
};

function hasValidFileSignature(contentType: string, bytes: Uint8Array) {
  return FILE_SIGNATURES[contentType]?.(bytes) ?? false;
}

@Injectable()
export class StorageValidationService {
  validateDeclaration(input: StorageValidationInput) {
    const fileName = normalizedFileName(input.fileName);
    const contentType = input.contentType.trim().toLowerCase();
    const rule = STORAGE_USAGE_RULES[input.usage];
    if (!rule.contentTypes.includes(contentType)) throw new BadRequestException('This file type is not allowed for this upload');
    const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
    if (!EXTENSIONS[contentType]?.includes(extension)) throw new BadRequestException('File extension does not match its content type');
    if (!Number.isInteger(input.byteSize) || input.byteSize <= 0) throw new BadRequestException('File size must be greater than zero');
    if (input.byteSize > rule.maxBytes) throw new BadRequestException('File exceeds the allowed size');
    return { fileName, contentType, byteSize: input.byteSize, checksumSha256: normalizedChecksum(input.checksumSha256) };
  }

  validateBytes(input: StorageValidationInput, bytes: Uint8Array) {
    const declaration = this.validateDeclaration(input);
    if (bytes.byteLength !== declaration.byteSize) throw new BadRequestException('Uploaded bytes do not match the declared size');
    const checksumSha256 = createHash('sha256').update(bytes).digest('hex');
    if (checksumSha256 !== declaration.checksumSha256) throw new BadRequestException('Uploaded bytes do not match the declared checksum');
    if (!hasValidFileSignature(declaration.contentType, bytes)) throw new BadRequestException('Uploaded bytes do not match the declared file type');
    return { ...declaration, checksumSha256 };
  }
}
