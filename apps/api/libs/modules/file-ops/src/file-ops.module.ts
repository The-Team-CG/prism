import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/database';
import { AccessControlModule } from '@prism/modules/access-control';
import { OpsEventFileRequirementsController } from './controllers/event-file-requirements.controller';
import { FILE_REQUIREMENT_COMMANDS, FILE_REQUIREMENT_READER, SIGNED_UPLOAD_URL_FACTORY } from './ports/file-ops.tokens';
import { MetadataOnlySignedUploadUrlFactory } from './ports/signed-upload-url-factory.port';
import { DocumentVaultService } from './services/document-vault.service';
import { FileRequirementsMatrixService } from './services/file-requirements-matrix.service';

const metadataOnlyFileCommands = { storageProviderMode: 'metadata_only' as const };

/**
 * Owned tables: none.
 * Read-only: OpsBillingStatement (via finance-ops, inquiry-onboarding), OpsDocument (via finance-ops, inquiry-onboarding, supplier-ops), OpsEvent (via inquiry-onboarding), OpsPaymentMilestone (via finance-ops, inquiry-onboarding), OpsPostEventDocument (via inquiry-onboarding), OpsSupplierReview (via supplier-ops).
 *
 * Read-only-by-design: serves a requirements-matrix view over documents owned elsewhere; writes no Prisma models itself.
 */
@Module({
  imports: [DatabaseModule, AccessControlModule],
  controllers: [OpsEventFileRequirementsController],
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
