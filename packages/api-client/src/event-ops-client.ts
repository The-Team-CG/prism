import type {
  EventOpsClient,
  EventOpsClientOptions,
} from "./event-ops-client/contracts.js";
import { createAuthClient } from "./event-ops-client/auth.js";
import { createSampleClient } from "./event-ops-client/sample.js";
import { createInquiriesClient } from "./event-ops-client/inquiries.js";
import { createEventsClient } from "./event-ops-client/events.js";
import { createWorkspacesClient } from "./event-ops-client/workspaces.js";
import { createGuestClient } from "./event-ops-client/guest.js";
import { createLiveOpsClient } from "./event-ops-client/live-ops.js";
import { createSupplierApplicationsClient } from "./event-ops-client/supplier-applications.js";
import { createCommunicationClient } from "./event-ops-client/communication.js";

export * from "./event-ops-client/contracts.js";

export function createEventOpsClient(
  options: EventOpsClientOptions = {},
): EventOpsClient {
  return {
    ...createAuthClient(options),
    ...createSampleClient(options),
    ...createInquiriesClient(options),
    ...createEventsClient(options),
    ...createWorkspacesClient(options),
    ...createGuestClient(options),
    ...createLiveOpsClient(options),
    ...createSupplierApplicationsClient(options),
    ...createCommunicationClient(options),
  };
}
