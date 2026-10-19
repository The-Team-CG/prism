import { signAddendumConformeExecutionSchema, type PrismAddendum, type PrismAddendumConformeExecution } from "@prism/types";
import { clientAddendaRepository } from "../data/client-addenda-repository";

/** Builds the acknowledgment from the exact version on screen; the server rejects any other displayed version. */
export function acknowledgeAddendumConformeUseCase(eventId: string, addendum: PrismAddendum): Promise<PrismAddendumConformeExecution> {
  const execution = addendum.conforme;
  if (!execution) throw new Error("This addendum does not have a conforme to acknowledge yet.");
  const parsed = signAddendumConformeExecutionSchema.safeParse({
    executionId: execution.id,
    versionNumber: addendum.versionNumber,
    documentSha256: execution.documentSha256,
    consentAccepted: true,
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Unable to record your acknowledgment.");
  return clientAddendaRepository.acknowledge(eventId, addendum.id, parsed.data);
}
