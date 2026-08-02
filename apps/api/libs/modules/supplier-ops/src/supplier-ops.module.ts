import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/database';
import { AccessControlModule } from '@prism/modules/access-control';
import { AiGovernanceModule, PAREService } from '@prism/modules/ai-governance';
import { EventCoreModule } from '@prism/modules/event-core';
import { EventSessionModule } from '@prism/modules/event-session';
import { FileOpsModule, DocumentVaultService } from '@prism/modules/file-ops';
import { TrustOpsModule } from '@prism/modules/trust-ops';
import { OpsEventSupplierWithdrawalController } from './controllers/event-supplier-withdrawal.controller';
import { OpsSupplierApplicationsController } from './controllers/supplier-applications.controller';
import { OpsSupplierDirectoryController } from './controllers/supplier-directory.controller';
import { OpsSupplierPareController } from './controllers/supplier-pare.controller';
import { OpsSupplierWorkspaceCommandsController } from './controllers/supplier-workspace-commands.controller';
import { OpsSuppliersController } from './controllers/suppliers.controller';
import {
  SUPPLIER_COMMANDS,
  SUPPLIER_DIRECTORY,
  SUPPLIER_DOCUMENT_VAULT,
  SUPPLIER_LIVE_OPERATIONS,
  SUPPLIER_PARE_AUTOMATION,
} from './ports/supplier-ops.tokens';
import type { SupplierLiveOperations } from './ports/supplier-live-operations.port';
import { SupplierApplicationService } from './services/supplier-application.service';
import { SupplierNetworkWorkflowService } from './services/supplier-network-workflow.service';
import { SupplierProfileCommandsService } from './services/supplier-profile-commands.service';
import { SuppliersService } from './services/suppliers.service';

const supplierDirectoryProvider = {
  provide: SUPPLIER_DIRECTORY,
  useExisting: SuppliersService,
};

const supplierCommandsProvider = {
  provide: SUPPLIER_COMMANDS,
  useExisting: SupplierNetworkWorkflowService,
};

const unsupportedSupplierLiveOperations: SupplierLiveOperations = {
  recordEventDayLog: async () => {
    throw new Error('Supplier live operations are still owned by event-ops until the live-ops split moves.');
  },
};

@Module({
  imports: [DatabaseModule, AccessControlModule, AiGovernanceModule, EventCoreModule, TrustOpsModule, FileOpsModule, EventSessionModule],
  controllers: [
    OpsEventSupplierWithdrawalController,
    OpsSupplierApplicationsController,
    OpsSupplierDirectoryController,
    OpsSuppliersController,
    OpsSupplierWorkspaceCommandsController,
    OpsSupplierPareController,
  ],
  providers: [
    SuppliersService,
    SupplierApplicationService,
    supplierDirectoryProvider,
    SupplierProfileCommandsService,
    SupplierNetworkWorkflowService,
    supplierCommandsProvider,
    { provide: SUPPLIER_DOCUMENT_VAULT, useExisting: DocumentVaultService },
    { provide: SUPPLIER_LIVE_OPERATIONS, useValue: unsupportedSupplierLiveOperations },
    { provide: SUPPLIER_PARE_AUTOMATION, useFactory: (pareService: PAREService) => pareService, inject: [PAREService] },
  ],
  exports: [
    SuppliersService,
    supplierDirectoryProvider,
    supplierCommandsProvider,
    SupplierProfileCommandsService,
    SupplierNetworkWorkflowService,
    SUPPLIER_COMMANDS,
  ],
})
export class SupplierOpsModule {}
