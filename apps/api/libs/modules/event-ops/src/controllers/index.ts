export { SampleController } from './sample.controller';
export { OpsAuthController } from '@prism/modules/identity-ops';
export { OpsEventsController, OpsComplianceController } from './events.controller';
export { OpsSuppliersController } from '@prism/modules/supplier-ops';
export { OpsSupplierWorkspaceController } from './supplier-workspace.controller';
export { OpsCoordinatorWorkspaceController } from './coordinator-workspace.controller';
export { OpsPmcmDashboardController } from './pmcm-dashboard.controller';
export { OpsAiController } from './ai.controller';

import { SampleController } from './sample.controller';
import { OpsEventsController, OpsComplianceController } from './events.controller';
import { OpsSupplierWorkspaceController } from './supplier-workspace.controller';
import { OpsCoordinatorWorkspaceController } from './coordinator-workspace.controller';
import { OpsPmcmDashboardController } from './pmcm-dashboard.controller';
import { OpsAiController } from './ai.controller';

export const EVENT_OPS_CONTROLLERS = [
  SampleController,
  OpsEventsController,
  OpsComplianceController,
  OpsSupplierWorkspaceController,
  OpsCoordinatorWorkspaceController,
  OpsPmcmDashboardController,
  OpsAiController,
];
