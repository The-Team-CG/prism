import type {
  EventOpsClient,
  EventOpsClientOptions,
} from "./event-ops-client/contracts";
import { createAuthClient } from "./event-ops-client/auth";
import { createInquiriesClient } from "./event-ops-client/inquiries";
import { createEventsClient } from "./event-ops-client/events";
import { createWorkspacesClient } from "./event-ops-client/workspaces";
import { createGuestClient } from "./event-ops-client/guest";
import { createLiveOpsClient } from "./event-ops-client/live-ops";
import { createSupplierApplicationsClient } from "./event-ops-client/supplier-applications";
import { createCommunicationClient } from "./event-ops-client/communication";
import { createEventGamesClient } from "./event-ops-client/event-games";
import { createSupplierWorkflowsClient } from "./event-ops-client/supplier-workflows";

export * from "./event-ops-client/contracts";

export function createEventOpsClient(
  options: EventOpsClientOptions = {},
): EventOpsClient {
  return {
    ...createAuthClient(options),
    ...createInquiriesClient(options),
    ...createEventsClient(options),
    ...createWorkspacesClient(options),
    ...createGuestClient(options),
    ...createLiveOpsClient(options),
    ...createSupplierApplicationsClient(options),
    ...createCommunicationClient(options),
    ...createEventGamesClient(options),
    ...createSupplierWorkflowsClient(options),
  };
}
