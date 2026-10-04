import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/kernel/database';
import { REGISTRATION_SUPPLIER_REFERENCE_READER } from './contracts/registration-supplier-reference.port';
import { RegistrationSupplierReferenceService } from './application/suppliers/registration-supplier-reference.service';

/** Narrow Commercial owner capability for supplier eligibility in Operations. */
@Module({
  imports: [DatabaseModule],
  providers: [
    RegistrationSupplierReferenceService,
    { provide: REGISTRATION_SUPPLIER_REFERENCE_READER, useExisting: RegistrationSupplierReferenceService },
  ],
  exports: [REGISTRATION_SUPPLIER_REFERENCE_READER],
})
export class RegistrationSupplierReferenceModule {}