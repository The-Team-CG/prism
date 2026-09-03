import { fileRequirementsMatrixRepository } from "../data/file-requirements-matrix-repository";

export function loadFileRequirementsMatrix(eventId: string) {
  return fileRequirementsMatrixRepository.load(eventId);
}
