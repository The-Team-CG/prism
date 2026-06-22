import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/database';
import { AccessControlModule } from '@prism/modules/access-control';
import { OpsSupplierDirectoryController } from './controllers/supplier-directory.controller';
import { SUPPLIER_DIRECTORY } from './ports/supplier-ops.tokens';
import { SuppliersService } from './services/suppliers.service';

const supplierDirectoryProvider = {
  provide: SUPPLIER_DIRECTORY,
  useExisting: SuppliersService,
};

@Module({
  imports: [DatabaseModule, AccessControlModule],
  controllers: [OpsSupplierDirectoryController],
  providers: [SuppliersService, supplierDirectoryProvider],
  exports: [SuppliersService, supplierDirectoryProvider],
})
export class SupplierOpsModule {}