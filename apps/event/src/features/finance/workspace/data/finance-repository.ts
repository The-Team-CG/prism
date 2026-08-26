import { apiUrl } from "@/lib/prism-api";

export function billingStatementUrl(pdfUrl: string): string {
  return apiUrl(pdfUrl);
}
