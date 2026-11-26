import type {
  PrismCompanyNameChange,
  PrismConformeExecution,
  PrismDocument,
  PrismInquiry,
  PrismInquiryContextNote,
  PrismInquiryMergeRecord,
  PrismPortalInvitationResend,
} from "@prism/types";
import { prismRequest, prismSse } from "../http";
import type { EventOpsClient, EventOpsClientOptions } from "./contracts";
import { withBase, parseCommsDraftStreamEvent } from "./shared";

export function createInquiriesClient(
  options: EventOpsClientOptions,
): Pick<EventOpsClient, "inquiries" | "conformeDrafts"> {
  return {
    inquiries: {
      list: () =>
        prismRequest<PrismInquiry[]>(
          "/inquiries",
          withBase(options),
        ),
      create: (input) =>
        prismRequest<PrismInquiry>(
          "/inquiries",
          withBase(options, { method: "POST", body: input }),
        ),
      resendPortalInvitation: (inquiryId) =>
        prismRequest<PrismPortalInvitationResend>(
          `/inquiries/${encodeURIComponent(inquiryId)}/portal-invitation/resend`,
          withBase(options, { method: "POST" }),
        ),
      updateStatus: (inquiryId, input) =>
        prismRequest<PrismInquiry>(
          `/inquiries/${inquiryId}/status`,
          withBase(options, { method: "PATCH", body: input }),
        ),
      merge: (primaryInquiryId, input) =>
        prismRequest<PrismInquiryMergeRecord>(
          `/inquiries/${primaryInquiryId}/merge`,
          withBase(options, { method: "POST", body: input }),
        ),
      logOnBehalf: (input) =>
        prismRequest<PrismInquiry>(
          "/inquiries/log-on-behalf",
          withBase(options, { method: "POST", body: input }),
        ),
      sendConformeReminder: (inquiryId) =>
        prismRequest<PrismInquiry>(
          `/inquiries/${inquiryId}/conforme-reminders`,
          withBase(options, { method: "POST" }),
        ),
      uploadConforme: (inquiryId, input) =>
        prismRequest<PrismDocument>(
          `/inquiries/${inquiryId}/conforme`,
          withBase(options, { method: "POST", body: input }),
        ),
      setIntakePath: (inquiryId, input) =>
        prismRequest<PrismInquiry>(`/inquiries/${inquiryId}/intake-path`, withBase(options, { method: "PATCH", body: input })),
      setLanguage: (inquiryId, input) =>
        prismRequest<PrismInquiry>(`/inquiries/${encodeURIComponent(inquiryId)}/language`, withBase(options, { method: "PATCH", body: input })),
      companyNameChanges: (inquiryId) =>
        prismRequest<PrismCompanyNameChange[]>(`/inquiries/${inquiryId}/company-name-changes`, withBase(options)),
      updateCompanyName: (inquiryId, input) =>
        prismRequest<PrismCompanyNameChange>(`/inquiries/${inquiryId}/company-name`, withBase(options, { method: "PATCH", body: input })),
      contextNotes: (inquiryId) =>
        prismRequest<PrismInquiryContextNote[]>(`/inquiries/${inquiryId}/context-notes`, withBase(options)),
      addContextNote: (inquiryId, input) =>
        prismRequest<PrismInquiryContextNote>(`/inquiries/${inquiryId}/context-notes`, withBase(options, { method: "POST", body: input })),
      preConformeContext: (eventId) =>
        prismRequest<PrismInquiryContextNote[]>(`/events/${eventId}/pre-conforme-context`, withBase(options)),
      existingPreConformeWorkspace: (inquiryId) =>
        prismRequest<{ eventId: string | null }>(`/inquiries/${encodeURIComponent(inquiryId)}/pre-conforme-workspace`, withBase(options)),
      createPreConformeWorkspace: (inquiryId) =>
        prismRequest<{ eventId: string }>(`/inquiries/${encodeURIComponent(inquiryId)}/pre-conforme-workspace`, withBase(options, { method: "POST" })),
      latestConformeExecution: (inquiryId) =>
        prismRequest<PrismConformeExecution>(`/inquiries/${encodeURIComponent(inquiryId)}/conforme-executions/latest`, withBase(options)),
      createConformeExecution: (inquiryId, input) =>
        prismRequest<PrismConformeExecution>(`/inquiries/${encodeURIComponent(inquiryId)}/conforme-executions`, withBase(options, { method: "POST", body: input })),
      signConformeExecution: (inquiryId, executionId, input) =>
        prismRequest<PrismConformeExecution>(`/inquiries/${encodeURIComponent(inquiryId)}/conforme-executions/${encodeURIComponent(executionId)}/sign`, withBase(options, { method: "POST", body: input })),
      triageReview: (inquiryId) =>
        prismRequest<unknown>(`/inquiry-triage/${encodeURIComponent(inquiryId)}`, withBase(options)),
      runTriage: (inquiryId) =>
        prismRequest<unknown>("/inquiry-triage", withBase(options, { method: "POST", body: { inquiryId } })),
    },
    conformeDrafts: {
      getForInquiry: (inquiryId) =>
        prismRequest<unknown>(
          `/comms-drafts/${encodeURIComponent(inquiryId)}`,
          withBase(options),
        ),
      stream: (input, signal) =>
        prismSse(
          "/comms-drafts/stream",
          withBase(options, { method: "POST", body: input, signal }),
          parseCommsDraftStreamEvent,
        ),
      saveManual: (inquiryId, draft) =>
        prismRequest<unknown>(
          `/comms-drafts/${encodeURIComponent(inquiryId)}/manual`,
          withBase(options, { method: "POST", body: draft }),
        ),
      approve: (draftId, draft) =>
        prismRequest<unknown>(
          `/comms-drafts/${encodeURIComponent(draftId)}/approve`,
          withBase(options, { method: "POST", body: draft }),
        ),
      cancel: (draftId) =>
        prismRequest<unknown>(
          `/comms-drafts/${encodeURIComponent(draftId)}/cancel`,
          withBase(options, { method: "POST" }),
        ),
    },
  };
}
