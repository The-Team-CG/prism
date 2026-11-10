import { clientApi } from "@/lib/prism-api";
import type { CreatePrismInquiryInput, EditPublicInquiryInput, PrismInquiry, SaveInquiryDraftInput } from "@prism/types";

export const inquiryRepository = {
  create(input: CreatePrismInquiryInput): Promise<PrismInquiry> {
    return clientApi.inquiries.create(input);
  },
  /** FR-50 draft autosave and resume, and the submitter's 24-hour edit link. */
  saveDraft: (draftToken: string, input: SaveInquiryDraftInput) => clientApi.clientPortal.saveInquiryDraft(draftToken, input),
  getDraft: (draftToken: string) => clientApi.clientPortal.inquiryDraft(draftToken),
  discardDraft: (draftToken: string) => clientApi.clientPortal.discardInquiryDraft(draftToken),
  getEdit: (editToken: string) => clientApi.clientPortal.inquiryEdit(editToken),
  saveEdit: (editToken: string, input: EditPublicInquiryInput) => clientApi.clientPortal.saveInquiryEdit(editToken, input),
};
