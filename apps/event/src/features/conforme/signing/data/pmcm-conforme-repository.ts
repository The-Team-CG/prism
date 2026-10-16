import {
  createConformeExecutionSchema,
  type PrismConformeExecution,
  signConformeExecutionSchema,
} from "@prism/types";
import { eventApiRequest, storedEventAccessToken } from "@/lib/prism-api";

const DEFAULT_CONFORME_TEMPLATE = `CONFORME — {{eventName}}\n\nClient: {{clientName}}\nCompany: {{companyName}}\nEvent type: {{eventType}}\nEvent date: {{eventDate}}\n\nPlease review the event details above. By acknowledging this conforme, you confirm that you have reviewed this version and agree to proceed with the arrangements described by PMCM. This in-app acknowledgment is recorded against this document version; PMCM must countersign before the client event workspace opens.`;

export const pmcmConformeRepository = {
  latest(inquiryId: string): Promise<PrismConformeExecution> {
    return eventApiRequest(`/api/inquiries/${encodeURIComponent(inquiryId)}/conforme-executions/latest`);
  },

  async prepare(inquiryId: string): Promise<PrismConformeExecution> {
    let templateVersion = 1;
    try {
      const latest = await eventApiRequest<PrismConformeExecution>(`/api/inquiries/${encodeURIComponent(inquiryId)}/conforme-executions/latest`);
      templateVersion = latest.templateVersion + 1;
    } catch (error) {
      if (!(error && typeof error === "object" && "status" in error && error.status === 404)) throw error;
    }
    const input = createConformeExecutionSchema.parse({ templateVersion, templateContent: DEFAULT_CONFORME_TEMPLATE });
    return eventApiRequest(`/api/inquiries/${encodeURIComponent(inquiryId)}/conforme-executions`, {
      method: "POST", body: input, authToken: storedEventAccessToken(),
    });
  },

  sign(execution: PrismConformeExecution, inquiryId: string): Promise<PrismConformeExecution> {
    const input = signConformeExecutionSchema.parse({
      executionId: execution.id,
      templateVersion: execution.templateVersion,
      documentSha256: execution.documentSha256,
      consentAccepted: true,
    });
    return eventApiRequest(`/api/inquiries/${encodeURIComponent(inquiryId)}/conforme-executions/${encodeURIComponent(execution.id)}/sign`, {
      method: "POST", body: input, authToken: storedEventAccessToken(),
    });
  },
};
