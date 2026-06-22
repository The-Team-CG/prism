import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/database';
import { AccessControlModule } from '@prism/modules/access-control';
import { EventCoreModule } from '@prism/modules/event-core';
import { FileOpsModule, DocumentVaultService } from '@prism/modules/file-ops';
import { TrustOpsModule } from '@prism/modules/trust-ops';
import { OpsSupplierDirectoryController } from './controllers/supplier-directory.controller';
import { OpsSupplierWorkspaceCommandsController } from './controllers/supplier-workspace-commands.controller';
import { OpsSuppliersController } from './controllers/suppliers.controller';
import {
  SUPPLIER_DIRECTORY,
  SUPPLIER_DOCUMENT_VAULT,
  SUPPLIER_LIVE_OPERATIONS,
  SUPPLIER_PARE_AUTOMATION,
} from './ports/supplier-ops.tokens';
import type { SupplierLiveOperations } from './ports/supplier-live-operations.port';
import type { SupplierPareAutomation } from './ports/supplier-pare-automation.port';
import { SupplierNetworkWorkflowService } from './services/supplier-network-workflow.service';
import { SupplierProfileCommandsService } from './services/supplier-profile-commands.service';
import { SuppliersService } from './services/suppliers.service';

const supplierDirectoryProvider = {
  provide: SUPPLIER_DIRECTORY,
  useExisting: SuppliersService,
};

const unsupportedSupplierLiveOperations: SupplierLiveOperations = {
  recordEventDayLog: async () => {
    throw new Error('Supplier live operations are still owned by event-ops until the live-ops split moves.');
  },
};

const unsupportedSupplierPareAutomation: SupplierPareAutomation = {
  getPendingApprovals: async () => {
    throw new Error('Supplier PARE automation is still owned by event-ops until the PARE split moves.');
  },
  approveRecommendation: async () => {
    throw new Error('Supplier PARE automation is still owned by event-ops until the PARE split moves.');
  },
  rejectRecommendation: async () => {
    throw new Error('Supplier PARE automation is still owned by event-ops until the PARE split moves.');
  },
  handleEmergencyTrigger: async () => {
    throw new Error('Supplier PARE automation is still owned by event-ops until the PARE split moves.');
  },
};

@Module({
  imports: [DatabaseModule, AccessControlModule, EventCoreModule, TrustOpsModule, FileOpsModule],
  controllers: [OpsSupplierDirectoryController, OpsSuppliersController, OpsSupplierWorkspaceCommandsController],
  providers: [
    SuppliersService,
    supplierDirectoryProvider,
    SupplierProfileCommandsService,
    SupplierNetworkWorkflowService,
    { provide: SUPPLIER_DOCUMENT_VAULT, useExisting: DocumentVaultService },
    { provide: SUPPLIER_LIVE_OPERATIONS, useValue: unsupportedSupplierLiveOperations },
    { provide: SUPPLIER_PARE_AUTOMATION, useValue: unsupportedSupplierPareAutomation },
  ],
  exports: [SuppliersService, supplierDirectoryProvider, SupplierProfileCommandsService],
})
export class SupplierOpsModule {}
