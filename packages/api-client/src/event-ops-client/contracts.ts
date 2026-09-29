export type {
  EventOpsActorQuery,
  EventOpsClientOptions,
} from "./contracts/primitives.js";

import type { EventOpsAuthContract } from "./contracts/auth.js";
import type { EventOpsSampleContract } from "./contracts/sample.js";
import type { EventOpsInquiryContract } from "./contracts/inquiries.js";
import type { EventOpsEventsContract } from "./contracts/events.js";
import type { EventOpsWorkspacesContract } from "./contracts/workspaces.js";
import type { EventOpsGuestContract } from "./contracts/guest.js";
import type { EventOpsLiveOpsContract } from "./contracts/live-ops.js";
import type { EventOpsSupplierApplicationsContract } from "./contracts/supplier-applications.js";
import type { EventOpsCommunicationContract } from "./contracts/communication.js";

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
    EventOpsSampleContract,
    EventOpsInquiryContract,
    EventOpsEventsContract,
    EventOpsWorkspacesContract,
    EventOpsGuestContract,
    EventOpsLiveOpsContract,
    EventOpsSupplierApplicationsContract,
    EventOpsCommunicationContract {}
