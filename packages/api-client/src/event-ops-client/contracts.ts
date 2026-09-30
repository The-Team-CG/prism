export type {
  EventOpsActorQuery,
  EventOpsClientOptions,
} from "./contracts/primitives";

import type { EventOpsAuthContract } from "./contracts/auth";
import type { EventOpsInquiryContract } from "./contracts/inquiries";
import type { EventOpsEventsContract } from "./contracts/events";
import type { EventOpsWorkspacesContract } from "./contracts/workspaces";
import type { EventOpsGuestContract } from "./contracts/guest";
import type { EventOpsLiveOpsContract } from "./contracts/live-ops";
import type { EventOpsSupplierApplicationsContract } from "./contracts/supplier-applications";
import type { EventOpsCommunicationContract } from "./contracts/communication";

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
  CreateFloorPlanRevisionCommentInput,
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
  UploadContractInput,
} from "@prism/types";

export interface EventOpsClient
  extends EventOpsAuthContract,
    EventOpsInquiryContract,
    EventOpsEventsContract,
    EventOpsWorkspacesContract,
    EventOpsGuestContract,
    EventOpsLiveOpsContract,
    EventOpsSupplierApplicationsContract,
    EventOpsCommunicationContract {}
