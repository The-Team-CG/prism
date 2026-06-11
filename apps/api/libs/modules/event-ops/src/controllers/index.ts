export { SampleController } from './sample.controller';
export { OpsAuthController } from './auth.controller';
export { OpsAuditController, OpsPrivacyController } from './audit-privacy.controller';
export { OpsNotificationsController } from './notifications.controller';
export { OpsInquiriesController } from './inquiries.controller';
export { OpsEventsController, OpsComplianceController } from './events.controller';
export { OpsSuppliersController } from './suppliers.controller';
export { OpsQuoteRequestsController } from './quote-requests.controller';
export { OpsSupplierWorkspaceController } from './supplier-workspace.controller';
export { OpsCoordinatorWorkspaceController, OpsCoordinatorsController } from './coordinator-workspace.controller';
export { OpsBillingController } from './billing.controller';
export { OpsOnboardingController, OpsClientController } from './client-workspace.controller';
export { OpsGuestController } from './guest.controller';
export { OpsAiController } from './ai.controller';

import { SampleController } from './sample.controller';
import { OpsAuthController } from './auth.controller';
import { OpsAuditController, OpsPrivacyController } from './audit-privacy.controller';
import { OpsNotificationsController } from './notifications.controller';
import { OpsInquiriesController } from './inquiries.controller';
import { OpsEventsController, OpsComplianceController } from './events.controller';
import { OpsSuppliersController } from './suppliers.controller';
import { OpsQuoteRequestsController } from './quote-requests.controller';
import { OpsSupplierWorkspaceController } from './supplier-workspace.controller';
import { OpsCoordinatorWorkspaceController, OpsCoordinatorsController } from './coordinator-workspace.controller';
import { OpsBillingController } from './billing.controller';
import { OpsOnboardingController, OpsClientController } from './client-workspace.controller';
import { OpsGuestController } from './guest.controller';
import { OpsAiController } from './ai.controller';

export const EVENT_OPS_CONTROLLERS = [
  SampleController,
  OpsAuthController,
  OpsAuditController,
  OpsPrivacyController,
  OpsNotificationsController,
  OpsInquiriesController,
  OpsEventsController,
  OpsComplianceController,
  OpsSuppliersController,
  OpsQuoteRequestsController,
  OpsSupplierWorkspaceController,
  OpsCoordinatorWorkspaceController,
  OpsCoordinatorsController,
  OpsBillingController,
  OpsOnboardingController,
  OpsClientController,
  OpsGuestController,
  OpsAiController,
];
