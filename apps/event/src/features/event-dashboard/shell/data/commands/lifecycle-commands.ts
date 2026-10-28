import { eventApi as eventOpsClient, eventApiRequest as request } from "@/lib/prism-api";
import type { PrismBriefing, PrismDocument, PrismEvent, PrismInquiry, PrismInquiryMergeRecord,PrismPmcmOcularVisit, RecordActualEventEndInput, ScheduleOcularVisitInput, SetClientEventDayViewInput, WaiveOcularVisitInput } from "@prism/types";
import { startEventDaySchema, type StartEventDayResult } from "@prism/types";

export const lifecycleCommands = {
startEventDay: (eventId: string) =>
    request<StartEventDayResult>(`/api/events/${eventId}/start-event-day`, { method: "POST", body: startEventDaySchema.parse({}) }),
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
declineInquiry: (inquiryId: string, declineReason: string) =>
    request<PrismInquiry>(`/api/inquiries/${inquiryId}/status`, {
      method: "PATCH",
      body: { status: "declined", declineReason },
    }),
mergeInquiry: (primaryInquiryId: string, input: { sourceInquiryId: string; reason: string }) =>
    request<PrismInquiryMergeRecord>(`/api/inquiries/${primaryInquiryId}/merge`, {
      method: "POST",
      body: input,
    }),
logInquiryOnBehalf: (
    input: {
      clientName: string;
      companyName?: string;
      email: string;
      eventName: string;
      eventType?: string;
      eventDate: string;
      clientType: string;
      channel?: string;
      referralDetails?: string;
      message: string;
    },
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
submitBriefing: (eventId: string) =>
    request<PrismBriefing>(`/api/events/${eventId}/briefing`, {
      method: "POST",
      body: {
        venue: "Shangri-La Grand Ballroom",
        guestCount: 240,
        budgetRange: "PHP 450,000 - 520,000",
        serviceRequirements: ["Digital Registration", "Stage and Technicals", "Documentation"],
        notes: "Client prefers a polished technology summit setup with clear ingress flow.",
      },
    }),
};
