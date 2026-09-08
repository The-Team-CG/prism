export {
  createEventOpsClient,
  type CreatePrismInquiryInput,
  type CreateGuestCheckInInput,
  type CreateGuestFeedbackInput,
  type ConfirmSupplierReadinessInput,
  type UploadContractInput,
  type UpdateSupplierEventStatusInput,
  type CreateEventDayTaskInput,
  type CreateEventTaskReassignmentInput,
  type DecideEventTaskReassignmentInput,
  type UpdateEventDayTaskInput,
  type UpdateCoordinatorAttendanceInput,
  type CreateUrgentIssueInput,
  type SubmitSupplierQuoteInput,
  type UpdateInquiryStatusInput,
  type UploadConformeInput,
  type CreateFloorPlanPreferenceInput,
  type CreateSupplierApplicationInput,
  type EventOpsActorQuery,
  type EventOpsClient,
  type EventOpsClientOptions,
} from "./event-ops-client";
export {
  DEFAULT_PRISM_API_BASE_URL,
  PrismApiError,
  normalizePrismApiProblem,
  prismRequest,
  resolvePrismApiBaseUrl,
  toQueryString,
  type PrismRequestInit,
} from "./http";

import { prismRequest, type PrismRequestInit } from "./http";

export async function prismJson<T>(path: string, init?: PrismRequestInit): Promise<T> {
  return prismRequest<T>(path, init);
}
