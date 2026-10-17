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
    return { ...declaration, checksumSha256 };
  }
}
