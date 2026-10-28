import { fileRequirementsMatrixRepository } from "../data/file-requirements-matrix-repository";

export function sendFileRequirementReminders(eventId: string) {
  return fileRequirementsMatrixRepository.sendReminders(eventId);
}
