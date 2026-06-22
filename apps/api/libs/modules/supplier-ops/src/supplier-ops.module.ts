import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/database';
import { AccessControlModule } from '@prism/modules/access-control';
import { EventCoreModule } from '@prism/modules/event-core';
import { TrustOpsModule } from '@prism/modules/trust-ops';
import { OpsSupplierDirectoryController } from './controllers/supplier-directory.controller';
import { OpsSuppliersController } from './controllers/suppliers.controller';
import { SUPPLIER_DIRECTORY } from './ports/supplier-ops.tokens';
import { SupplierProfileCommandsService } from './services/supplier-profile-commands.service';
import { SuppliersService } from './services/suppliers.service';

const supplierDirectoryProvider = {
  provide: SUPPLIER_DIRECTORY,
  useExisting: SuppliersService,
};

@Module({
  imports: [DatabaseModule, AccessControlModule, EventCoreModule, TrustOpsModule],
  controllers: [OpsSupplierDirectoryController, OpsSuppliersController],
  providers: [SuppliersService, supplierDirectoryProvider, SupplierProfileCommandsService],
  exports: [SuppliersService, supplierDirectoryProvider, SupplierProfileCommandsService],
})
export class SupplierOpsModule {}