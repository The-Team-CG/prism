import type { PrismInquiry, PrismPortalInvitationResend } from "@prism/types";
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
