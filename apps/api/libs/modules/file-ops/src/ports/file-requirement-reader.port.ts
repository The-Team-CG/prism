import type { FileRequirementsMatrix } from '../services/file-requirements-matrix.service';

export interface FileRequirementReader {
  buildForEvent(eventId: string): Promise<FileRequirementsMatrix>;
  closeGates(eventId: string): Promise<unknown>;
}