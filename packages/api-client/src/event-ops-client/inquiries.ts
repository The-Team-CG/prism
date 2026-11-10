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
import { withBase, actorPath, parseCommsDraftStreamEvent } from "./shared";

export function createInquiriesClient(
  options: EventOpsClientOptions,
): Pick<EventOpsClient, "inquiries" | "conformeDrafts"> {
  return {
    inquiries: {
      list: (actor = {}) =>
        prismRequest<PrismInquiry[]>(
          actorPath("/inquiries", actor),
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
      updateStatus: (inquiryId, input, actor = {}) =>
        prismRequest<PrismInquiry>(
          actorPath(`/inquiries/${inquiryId}/status`, actor),
          withBase(options, { method: "PATCH", body: input }),
        ),
      merge: (primaryInquiryId, input, actor = {}) =>
        prismRequest<PrismInquiryMergeRecord>(
          actorPath(`/inquiries/${primaryInquiryId}/merge`, actor),
          withBase(options, { method: "POST", body: input }),
        ),
      logOnBehalf: (input, actor = {}) =>
        prismRequest<PrismInquiry>(
          actorPath("/inquiries/log-on-behalf", actor),
          withBase(options, { method: "POST", body: input }),
        ),
      sendConformeReminder: (inquiryId, actor = {}) =>
        prismRequest<PrismInquiry>(
          actorPath(`/inquiries/${inquiryId}/conforme-reminders`, actor),
          withBase(options, { method: "POST" }),
        ),
      uploadConforme: (inquiryId, input, actor = {}) =>
        prismRequest<PrismDocument>(
          actorPath(`/inquiries/${inquiryId}/conforme`, actor),
          withBase(options, { method: "POST", body: input }),
        ),
      setIntakePath: (inquiryId, input, actor = {}) =>
        prismRequest<PrismInquiry>(actorPath(`/inquiries/${inquiryId}/intake-path`, actor), withBase(options, { method: "PATCH", body: input })),
      setLanguage: (inquiryId, input, actor = {}) =>
        prismRequest<PrismInquiry>(actorPath(`/inquiries/${encodeURIComponent(inquiryId)}/language`, actor), withBase(options, { method: "PATCH", body: input })),
      companyNameChanges: (inquiryId, actor = {}) =>
        prismRequest<PrismCompanyNameChange[]>(actorPath(`/inquiries/${inquiryId}/company-name-changes`, actor), withBase(options)),
      updateCompanyName: (inquiryId, input, actor = {}) =>
        prismRequest<PrismCompanyNameChange>(actorPath(`/inquiries/${inquiryId}/company-name`, actor), withBase(options, { method: "PATCH", body: input })),
      contextNotes: (inquiryId, actor = {}) =>
        prismRequest<PrismInquiryContextNote[]>(actorPath(`/inquiries/${inquiryId}/context-notes`, actor), withBase(options)),
      addContextNote: (inquiryId, input, actor = {}) =>
        prismRequest<PrismInquiryContextNote>(actorPath(`/inquiries/${inquiryId}/context-notes`, actor), withBase(options, { method: "POST", body: input })),
      preConformeContext: (eventId, actor = {}) =>
        prismRequest<PrismInquiryContextNote[]>(actorPath(`/events/${eventId}/pre-conforme-context`, actor), withBase(options)),
      existingPreConformeWorkspace: (inquiryId, actor = {}) =>
        prismRequest<{ eventId: string | null }>(actorPath(`/inquiries/${encodeURIComponent(inquiryId)}/pre-conforme-workspace`, actor), withBase(options)),
      createPreConformeWorkspace: (inquiryId, actor = {}) =>
        prismRequest<{ eventId: string }>(actorPath(`/inquiries/${encodeURIComponent(inquiryId)}/pre-conforme-workspace`, actor), withBase(options, { method: "POST" })),
      latestConformeExecution: (inquiryId, actor = {}) =>
        prismRequest<PrismConformeExecution>(actorPath(`/inquiries/${encodeURIComponent(inquiryId)}/conforme-executions/latest`, actor), withBase(options)),
      createConformeExecution: (inquiryId, input, actor = {}) =>
        prismRequest<PrismConformeExecution>(actorPath(`/inquiries/${encodeURIComponent(inquiryId)}/conforme-executions`, actor), withBase(options, { method: "POST", body: input })),
      signConformeExecution: (inquiryId, executionId, input, actor = {}) =>
        prismRequest<PrismConformeExecution>(actorPath(`/inquiries/${encodeURIComponent(inquiryId)}/conforme-executions/${encodeURIComponent(executionId)}/sign`, actor), withBase(options, { method: "POST", body: input })),
      triageReview: (inquiryId, actor = {}) =>
        prismRequest<unknown>(actorPath(`/inquiry-triage/${encodeURIComponent(inquiryId)}`, actor), withBase(options)),
      runTriage: (inquiryId, actor = {}) =>
        prismRequest<unknown>(actorPath("/inquiry-triage", actor), withBase(options, { method: "POST", body: { inquiryId } })),
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
