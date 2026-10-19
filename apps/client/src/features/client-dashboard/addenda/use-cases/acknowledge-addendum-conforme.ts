import { signAddendumConformeSchema, type PrismClientAddendumConforme } from "@prism/types";
import { clientAddendumConformeRepository } from "../data/client-addendum-conforme-repository";

/**
 * The acknowledgement binds to the exact version and document hash on screen, so the server rejects it if PMCM
 * replaced or altered the document after it was displayed.
 */
export function acknowledgeAddendumConformeUseCase(
  conforme: Pick<PrismClientAddendumConforme, "id" | "eventId" | "addendumId" | "documentVersion" | "documentSha256">,
  consentAccepted: boolean,
) {
  const parsed = signAddendumConformeSchema.safeParse({
    executionId: conforme.id,
    documentVersion: conforme.documentVersion,
    documentSha256: conforme.documentSha256,
    consentAccepted,
  });
  if (!parsed.success) throw new Error(consentAccepted ? "This addendum could not be verified. Refresh and try again." : "Confirm that you have reviewed the addendum before acknowledging it.");
  return clientAddendumConformeRepository.acknowledge(conforme.eventId, conforme.addendumId, parsed.data);
}
