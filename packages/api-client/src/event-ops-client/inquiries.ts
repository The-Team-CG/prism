import type { PrismDocument, PrismInquiry, PrismInquiryMergeRecord, PrismPortalInvitationResend } from "@prism/types";
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
