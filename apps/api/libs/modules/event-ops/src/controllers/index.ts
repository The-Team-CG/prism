export { SampleController } from './sample.controller';
export { OpsAuthController } from '@prism/modules/identity-ops';
export { OpsEventsController } from './events.controller';
export { OpsComplianceController } from '@prism/modules/compliance-ops';
export { OpsSuppliersController } from '@prism/modules/supplier-ops';
export { OpsPmcmDashboardController } from '@prism/modules/event-read-models';
export { OpsAiController } from './ai.controller';

import { SampleController } from './sample.controller';
import { OpsEventsController } from './events.controller';
import { OpsAiController } from './ai.controller';

export const EVENT_OPS_CONTROLLERS = [
  SampleController,
  OpsEventsController,
  OpsAiController,
];
