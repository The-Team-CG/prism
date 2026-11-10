import { eventApi as eventOpsClient } from "@/lib/prism-api";
import { parseContract, setEventModulesSchema, updateInquiryStatusSchema, type SetEventModulesInput } from "@prism/types";
import type { LogInquiryOnBehalfInput, PrismDocument, PrismEvent, PrismInquiry, PrismInquiryMergeRecord,PrismPmcmOcularVisit, RecordActualEventEndInput, ScheduleOcularVisitInput, SetClientEventDayViewInput, SetEventPrivacyInput, WaiveOcularVisitInput } from "@prism/types";
import { liveOpsScheduleRepository } from "@/features/live-ops/schedule/data/live-ops-schedule-repository";

export const lifecycleCommands = {
startEventDay: (eventId: string) => liveOpsScheduleRepository.startEventDay(eventId),
scheduleOcularVisit: (eventId: string, input: ScheduleOcularVisitInput) => eventOpsClient.lifecycle.scheduleOcularVisit(eventId, input),
completeOcularVisit: (eventId: string) => eventOpsClient.lifecycle.completeOcularVisit(eventId),
waiveOcularVisit: (eventId: string, input: WaiveOcularVisitInput) => eventOpsClient.lifecycle.waiveOcularVisit(eventId, input),
setEventModules: (eventId: string, input: SetEventModulesInput) =>
    eventOpsClient.lifecycle.setModules(eventId, parseContract(setEventModulesSchema, input, "Event modules")),
setEventPrivacy: (eventId: string, input: SetEventPrivacyInput) => eventOpsClient.lifecycle.setPrivacy(eventId, input),
setClientEventDayView: (eventId: string, input: SetClientEventDayViewInput) => eventOpsClient.lifecycle.setClientEventDayView(eventId, input),
acceptInquiry: (inquiryId: string) => eventOpsClient.inquiries.updateStatus(inquiryId, { status: "accepted" }),
archiveEvent: (eventId: string, overrideReason?: string) => eventOpsClient.lifecycle.archive(eventId, overrideReason),
recordActualEventEnd: (eventId: string, input: RecordActualEventEndInput) => eventOpsClient.lifecycle.recordActualEnd(eventId, input),
declineInquiry: (inquiryId: string, declineReason?: string) =>
    eventOpsClient.inquiries.updateStatus(inquiryId, parseContract(updateInquiryStatusSchema, { status: "declined", declineReason: declineReason || undefined }, "Inquiry decline")),
mergeInquiry: (primaryInquiryId: string, input: { sourceInquiryId: string; reason: string }) =>
    eventOpsClient.inquiries.merge(primaryInquiryId, input),
logInquiryOnBehalf: (
    input: LogInquiryOnBehalfInput,
    session: { name: string; email: string; role: string },
  ) => eventOpsClient.inquiries.logOnBehalf(input),
pendInquiry: (inquiryId: string) => eventOpsClient.inquiries.updateStatus(inquiryId, { status: "pending" }),
sendConformeReminder: (inquiryId: string) => eventOpsClient.inquiries.sendConformeReminder(inquiryId),
uploadConforme: (
    inquiryId: string,
    meta: { fileName: string; mimeType: string; sizeBytes: number },
  ) =>
    eventOpsClient.inquiries.uploadConforme(inquiryId, {
      type: "signed_conforme",
      fileName: meta.fileName,
      mimeType: meta.mimeType,
      sizeBytes: meta.sizeBytes,
    }),
};
