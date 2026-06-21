import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

export type UploadMetadataInput = {
  fileName: string;
  mimeType?: string;
  sizeBytes?: number;
};

export type ValidatedUploadMetadata = {
  originalFileName: string;
  generatedFileName: string;
  mimeType: string;
  sizeBytes: number;
  storageBucket: string;
  storageKey: string;
  validationStatus: 'accepted';
};

export type UploadValidationOptions = {
  maxSizeBytes?: number;
  allowedMimeTypes?: readonly string[];
};

const DEFAULT_MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024;
const ALLOWED_UPLOAD_TYPES: Record<string, string[]> = {
  'application/pdf': ['pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'video/mp4': ['mp4'],
  'video/quicktime': ['mov'],
};

@Injectable()
export class DocumentVaultService {
  validateUploadMetadata(
    input: UploadMetadataInput,
    prefix: string,
    options: UploadValidationOptions = {},
  ): ValidatedUploadMetadata {
    const fileName = input.fileName?.trim();
    if (!fileName) throw new BadRequestException('File name is required');
    const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
    const mimeType = input.mimeType?.trim().toLowerCase() ?? '';
    const allowedExtensions = ALLOWED_UPLOAD_TYPES[mimeType];
    const allowedByCaller = options.allowedMimeTypes ? options.allowedMimeTypes.includes(mimeType) : true;
    if (!allowedByCaller || !allowedExtensions || !allowedExtensions.includes(extension)) {
      throw new BadRequestException('Unsupported file type');
    }
    const sizeBytes = input.sizeBytes ?? 0;
    if (sizeBytes <= 0) throw new BadRequestException('File size is required');
    if (sizeBytes > (options.maxSizeBytes ?? DEFAULT_MAX_UPLOAD_SIZE_BYTES)) {
      throw new BadRequestException('File exceeds allowed size');
    }
    const generatedFileName = `${randomUUID()}.${extension}`;
    const cleanPrefix = prefix.replace(/^\/+|\/+$/g, '');
    return {
      originalFileName: fileName.replace(/^.*[\\/]/, ''),
      generatedFileName,
      mimeType,
      sizeBytes,
      storageBucket: 'document-vault',
      storageKey: `${cleanPrefix}/${generatedFileName}`,
      validationStatus: 'accepted',
    };
  }
}