export type {
  EventOpsActorQuery,
  EventOpsClientOptions,
  EventOpsReadInit,
} from "./contracts/primitives";

import type { EventOpsAuthContract } from "./contracts/auth";
import type { EventOpsInquiryContract } from "./contracts/inquiries";
import type { EventOpsEventsContract } from "./contracts/events";
import type { EventOpsWorkspacesContract } from "./contracts/workspaces";
import type { EventOpsGuestContract } from "./contracts/guest";
import type { EventOpsLiveOpsContract } from "./contracts/live-ops";
import type { EventOpsSupplierApplicationsContract } from "./contracts/supplier-applications";
import type { EventOpsCommunicationContract } from "./contracts/communication";
import type { EventOpsNotificationPreferencesContract, EventOpsPrivacyContract } from "./contracts/privacy";
import type { EventOpsEventGamesContract } from "./contracts/event-games";
import type { EventOpsSupplierWorkflowsContract } from "./contracts/supplier-workflows";
import type { EventOpsCommercialContract } from "./contracts/commercial";
import type { EventOpsLifecycleContract } from "./contracts/lifecycle";
import type { EventOpsStaffingContract } from "./contracts/staffing";
import type { EventOpsTrustContract } from "./contracts/trust";
import type { EventOpsPlatformContract } from "./contracts/platform";
import type { EventOpsClientPortalContract } from "./contracts/client-portal";
import type { EventOpsPlanningContract } from "./contracts/planning";

/**
 * Re-export write DTOs from `@prism/types` (Zod schemas + `z.infer`).
 * Prefer importing schemas/types from `@prism/types` directly in new code.
 */
export type {
  ConfirmSupplierReadinessInput,
  CreateEventDayTaskInput,
  CreateEventTaskReassignmentInput,
  DecideEventTaskReassignmentInput,
  CreateFloorPlanPreferenceInput,
  CreateGuestCheckInInput,
  CreateGuestFeedbackInput,
  ModerateGuestFeedbackInput,
  WithdrawGuestFeedbackConsentInput,
  CreateSupplierApplicationInput,
  SupplierApplicationStatusQuery,
  CreatePrismInquiryInput,
  CreateRegistrationPlatformInput,
  CreateUrgentIssueInput,
  ArchiveSearchFilters,
  ReviewEventProposalInput,
  ReviewSupplierApplicationInput,
  ImportHeadcountInput,
  SubmitSupplierQuoteInput,
  UpdateCoordinatorAttendanceInput,
  UpdateEventDayTaskInput,
  UpdateInquiryStatusInput,
  UpdateRegistrationPlatformInput,
  UpdateSupplierEventStatusInput,
  UploadConformeInput,
} from "@prism/types";

export interface EventOpsClient
  extends EventOpsAuthContract,
    EventOpsInquiryContract,
    EventOpsEventsContract,
    EventOpsWorkspacesContract,
    EventOpsGuestContract,
    EventOpsLiveOpsContract,
    EventOpsSupplierApplicationsContract,
    EventOpsCommunicationContract,
    EventOpsPrivacyContract,
    EventOpsNotificationPreferencesContract,
    EventOpsEventGamesContract,
    EventOpsSupplierWorkflowsContract,
    EventOpsCommercialContract,
    EventOpsLifecycleContract,
    EventOpsStaffingContract,
    EventOpsTrustContract,
    EventOpsPlatformContract,
    EventOpsPlanningContract,
    EventOpsClientPortalContract {}
