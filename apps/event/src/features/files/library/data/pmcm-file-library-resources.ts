import { defineResource } from "@prism/portal-query";
import { fileRequirementsMatrixRepository } from "../../matrix/data/file-requirements-matrix-repository";
import { pmcmDocumentRepository } from "./pmcm-document-repository";

/** Every stored file on one event, from PMCM, the client and suppliers. */
export const pmcmEventStoredFiles = defineResource({
  name: "pmcm.event-stored-files",
  fetch: (eventId: string) => pmcmDocumentRepository.list(eventId),
});

/** One event's file requirements with every upload sent for them, which is where reviews happen. */
export const pmcmEventFileRequirements = defineResource({
  name: "pmcm.event-file-requirements",
  fetch: (eventId: string) => fileRequirementsMatrixRepository.load(eventId),
});
