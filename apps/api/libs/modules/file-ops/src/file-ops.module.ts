import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/database';
import { FILE_REQUIREMENT_COMMANDS, FILE_REQUIREMENT_READER, SIGNED_UPLOAD_URL_FACTORY } from './ports/file-ops.tokens';
import { MetadataOnlySignedUploadUrlFactory } from './ports/signed-upload-url-factory.port';
import { DocumentVaultService } from './services/document-vault.service';
import { FileRequirementsMatrixService } from './services/file-requirements-matrix.service';

const metadataOnlyFileCommands = { storageProviderMode: 'metadata_only' as const };

@Module({
  imports: [DatabaseModule],
  providers: [
    DocumentVaultService,
    FileRequirementsMatrixService,
    MetadataOnlySignedUploadUrlFactory,
    { provide: FILE_REQUIREMENT_READER, useExisting: FileRequirementsMatrixService },
    { provide: FILE_REQUIREMENT_COMMANDS, useValue: metadataOnlyFileCommands },
    { provide: SIGNED_UPLOAD_URL_FACTORY, useExisting: MetadataOnlySignedUploadUrlFactory },
  ],
  exports: [
    DocumentVaultService,
    FileRequirementsMatrixService,
    FILE_REQUIREMENT_READER,
    FILE_REQUIREMENT_COMMANDS,
    SIGNED_UPLOAD_URL_FACTORY,
  ],
})
export class FileOpsModule {}