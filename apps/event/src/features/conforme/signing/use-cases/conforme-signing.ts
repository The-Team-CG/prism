import type { PrismConformeExecution } from "@prism/types";
import { pmcmConformeRepository } from "../data/pmcm-conforme-repository";

export function prepareConformeExecution(inquiryId: string) {
  return pmcmConformeRepository.prepare(inquiryId);
}

export function refreshConformeExecution(inquiryId: string) {
  return pmcmConformeRepository.latest(inquiryId);
}

/** Saves the latest conforme document as a PDF for PMCM to print and hand over for physical signing. */
export async function downloadConformePdf(inquiryId: string) {
  const blob = await pmcmConformeRepository.latestPdf(inquiryId);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `conforme-${inquiryId}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}

export function countersignConformeExecution(inquiryId: string, execution: PrismConformeExecution) {
  return pmcmConformeRepository.sign(execution, inquiryId);
}
