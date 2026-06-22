export { SampleController } from './sample.controller';
export { OpsAuthController } from './auth.controller';
export { OpsAuditController, OpsPrivacyController } from './audit-privacy.controller';
export { OpsNotificationsController } from './notifications.controller';
export { OpsEventsController, OpsComplianceController } from './events.controller';
export { OpsSuppliersController } from './suppliers.controller';
export { OpsSupplierWorkspaceController } from './supplier-workspace.controller';
export { OpsCoordinatorWorkspaceController, OpsCoordinatorsController } from './coordinator-workspace.controller';
export { OpsBillingController } from './billing.controller';
export { OpsOnboardingController, OpsClientController } from './client-workspace.controller';
export { OpsPmcmDashboardController } from './pmcm-dashboard.controller';
export { OpsAiController } from './ai.controller';

import { SampleController } from './sample.controller';
import { OpsAuthController } from './auth.controller';
import { OpsAuditController, OpsPrivacyController } from './audit-privacy.controller';
import { OpsNotificationsController } from './notifications.controller';
import { OpsEventsController, OpsComplianceController } from './events.controller';
import { OpsSuppliersController } from './suppliers.controller';
import { OpsSupplierWorkspaceController } from './supplier-workspace.controller';
import { OpsCoordinatorWorkspaceController, OpsCoordinatorsController } from './coordinator-workspace.controller';
import { OpsBillingController } from './billing.controller';
import { OpsOnboardingController, OpsClientController } from './client-workspace.controller';
import { OpsPmcmDashboardController } from './pmcm-dashboard.controller';
import { OpsAiController } from './ai.controller';

export const EVENT_OPS_CONTROLLERS = [
  SampleController,
  OpsAuthController,
  OpsAuditController,
  OpsPrivacyController,
  OpsNotificationsController,
  OpsEventsController,
  OpsComplianceController,
  OpsSuppliersController,
  OpsSupplierWorkspaceController,
  OpsCoordinatorWorkspaceController,
  OpsCoordinatorsController,
  OpsBillingController,
  OpsOnboardingController,
  OpsClientController,
  OpsPmcmDashboardController,
  OpsAiController,
];
