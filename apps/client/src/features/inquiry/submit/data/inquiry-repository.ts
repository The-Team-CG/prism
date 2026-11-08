import { clientApi, clientApiRequest } from "@/lib/prism-api";
import type { CreatePrismInquiryInput, EditPublicInquiryInput, PrismInquiry, PrismInquiryDraft, PrismPublicInquiryEdit, SaveInquiryDraftInput } from "@prism/types";

const token = (value: string) => encodeURIComponent(value);

export const inquiryRepository = {
  create(input: CreatePrismInquiryInput): Promise<PrismInquiry> {
    return clientApi.inquiries.create(input);
  },
  /** FR-50 draft autosave and resume, and the submitter's 24-hour edit link. */
  saveDraft: (draftToken: string, input: SaveInquiryDraftInput) => clientApiRequest<PrismInquiryDraft>(`/public-inquiries/drafts/${token(draftToken)}`, { method: "PUT", body: input }),
  getDraft: (draftToken: string) => clientApiRequest<PrismInquiryDraft>(`/public-inquiries/drafts/${token(draftToken)}`),
  discardDraft: (draftToken: string) => clientApiRequest<void>(`/public-inquiries/drafts/${token(draftToken)}`, { method: "DELETE" }),
  getEdit: (editToken: string) => clientApiRequest<PrismPublicInquiryEdit>(`/public-inquiries/edit/${token(editToken)}`),
  saveEdit: (editToken: string, input: EditPublicInquiryInput) => clientApiRequest<PrismPublicInquiryEdit>(`/public-inquiries/edit/${token(editToken)}`, { method: "PATCH", body: input }),
};
