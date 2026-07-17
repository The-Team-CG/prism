import { inquiryRepository } from "../data/inquiry-repository";
import { buildInquiryPayload } from "../model/inquiry-submit-rules";
import type { InquiryForm } from "../model/inquiry-submit-types";

export async function submitInquiry(form: InquiryForm) {
  const payload = buildInquiryPayload(form);
  return inquiryRepository.create(payload);
}
