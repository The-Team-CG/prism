import { eventApi as eventOpsClient, eventApiRequest as request } from "@/lib/prism-api";
import { parseContract, setEventModulesSchema, type SetEventModulesInput } from "@prism/types";
import type { LogInquiryOnBehalfInput, PrismDocument, PrismEvent, PrismInquiry, PrismInquiryMergeRecord,PrismPmcmOcularVisit, RecordActualEventEndInput, ScheduleOcularVisitInput, SetClientEventDayViewInput, SetEventPrivacyInput, WaiveOcularVisitInput } from "@prism/types";
import { liveOpsScheduleRepository } from "@/features/live-ops/schedule/data/live-ops-schedule-repository";

export const lifecycleCommands = {
startEventDay: (eventId: string) => liveOpsScheduleRepository.startEventDay(eventId),
scheduleOcularVisit: (eventId: string, input: ScheduleOcularVisitInput) =>
    request<PrismPmcmOcularVisit>(`/api/events/${eventId}/ocular-visit/schedule`, {
      method: "PATCH",
      body: input,
    }),
completeOcularVisit: (eventId: string) =>
    request<PrismPmcmOcularVisit>(`/api/events/${eventId}/ocular-visit/complete`, {
      method: "POST",
    }),
waiveOcularVisit: (eventId: string, input: WaiveOcularVisitInput) =>
    request<PrismPmcmOcularVisit>(`/api/events/${eventId}/ocular-visit/waive`, {
      method: "POST",
      body: input,
    }),
setEventModules: (eventId: string, input: SetEventModulesInput) =>
    request<{ eventId: string; disabledModules: SetEventModulesInput["disabledModules"] }>(`/api/events/${eventId}/modules`, {
      method: "PATCH",
      body: parseContract(setEventModulesSchema, input, "Event modules"),
    }),
setEventPrivacy: (eventId: string, input: SetEventPrivacyInput) =>
    request<{ eventId: string; privacy: SetEventPrivacyInput["privacy"] }>(`/api/events/${eventId}/privacy`, {
      method: "PATCH",
      body: input,
    }),
setClientEventDayView: (eventId: string, input: SetClientEventDayViewInput) =>
    request<PrismEvent>("/api/events/" + eventId + "/client-event-day-view", {
      method: "PATCH",
      body: input,
    }),
acceptInquiry: (inquiryId: string) =>
    request<PrismInquiry>(`/api/inquiries/${inquiryId}/status`, {
      method: "PATCH",
      body: { status: "accepted" },
    }),
archiveEvent: (eventId: string, overrideReason?: string) =>
    request<PrismEvent>(`/api/events/${eventId}/archive`, {
      method: "POST",
      body: { overrideReason },
    }),
recordActualEventEnd: (eventId: string, input: RecordActualEventEndInput) =>
    request<PrismEvent>(`/api/events/${eventId}/actual-end`, { method: "POST", body: input }),
declineInquiry: (inquiryId: string, declineReason?: string) =>
    request<PrismInquiry>(`/api/inquiries/${inquiryId}/status`, {
      method: "PATCH",
      body: { status: "declined", declineReason: declineReason || undefined },
    }),
mergeInquiry: (primaryInquiryId: string, input: { sourceInquiryId: string; reason: string }) =>
    request<PrismInquiryMergeRecord>(`/api/inquiries/${primaryInquiryId}/merge`, {
      method: "POST",
      body: input,
    }),
logInquiryOnBehalf: (
    input: LogInquiryOnBehalfInput,
    session: { name: string; email: string; role: string },
  ) =>
    request<PrismInquiry>("/api/inquiries/log-on-behalf", {
      method: "POST",
      body: input,
    }),
pendInquiry: (inquiryId: string) =>
    request<PrismInquiry>(`/api/inquiries/${inquiryId}/status`, {
      method: "PATCH",
      body: { status: "pending" },
    }),
sendConformeReminder: (inquiryId: string) =>
    request<PrismInquiry>(`/api/inquiries/${inquiryId}/conforme-reminders`, { method: "POST" }),
uploadConforme: (
    inquiryId: string,
    meta: { fileName: string; mimeType: string; sizeBytes: number },
  ) =>
    request<PrismDocument>(`/api/inquiries/${inquiryId}/conforme`, {
      method: "POST",
      body: {
        type: "signed_conforme",
        fileName: meta.fileName,
        mimeType: meta.mimeType,
        sizeBytes: meta.sizeBytes,
      },
    }),
};
