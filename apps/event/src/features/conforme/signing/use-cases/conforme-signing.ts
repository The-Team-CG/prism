import type { PrismConformeExecution } from "@prism/types";
import { pmcmConformeRepository } from "../data/pmcm-conforme-repository";

export function prepareConformeExecution(inquiryId: string) {
  return pmcmConformeRepository.prepare(inquiryId);
}

export function refreshConformeExecution(inquiryId: string) {
  return pmcmConformeRepository.latest(inquiryId);
}

export function countersignConformeExecution(inquiryId: string, execution: PrismConformeExecution) {
  return pmcmConformeRepository.sign(execution, inquiryId);
}
