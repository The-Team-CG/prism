export { SampleController } from './sample.controller';
export { OpsAuthController } from '@prism/modules/identity-ops';
export { OpsComplianceController } from '@prism/modules/compliance-ops';
export { OpsSuppliersController } from '@prism/modules/supplier-ops';
export { OpsPmcmDashboardController } from '@prism/modules/event-read-models';
export { OpsAiController } from './ai.controller';

import { SampleController } from './sample.controller';

export const EVENT_OPS_CONTROLLERS = [
  SampleController,
];
