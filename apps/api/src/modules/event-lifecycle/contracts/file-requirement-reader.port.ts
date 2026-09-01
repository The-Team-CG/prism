import type { FileRequirementsMatrix } from '../application/files/file-requirements-matrix.service';

export interface FileRequirementReader {
  buildForEvent(eventId: string): Promise<FileRequirementsMatrix>;
  closeGates(eventId: string): Promise<unknown>;
}
