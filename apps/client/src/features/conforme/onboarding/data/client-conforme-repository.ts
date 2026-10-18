import {
  signConformeExecutionSchema,
  type PrismConformeExecution,
  type SignConformeExecutionInput,
} from "@prism/types";
import { clientApiRequest, storedClientAccessToken } from "@/lib/prism-api";

export interface ClientConformeSnapshot {
  executions: PrismConformeExecution[];
}

export const clientConformeRepository = {
  load(): Promise<ClientConformeSnapshot> {
    return clientApiRequest("/client/conforme-execution");
  },

  sign(execution: PrismConformeExecution): Promise<PrismConformeExecution> {
    const input: SignConformeExecutionInput = signConformeExecutionSchema.parse({
      executionId: execution.id,
      templateVersion: execution.templateVersion,
      documentSha256: execution.documentSha256,
      consentAccepted: true,
    });
    return clientApiRequest("/client/conforme-execution/sign", {
      method: "POST",
      body: input,
      authToken: storedClientAccessToken(),
    });
  },
};
