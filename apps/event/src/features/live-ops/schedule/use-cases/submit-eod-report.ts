import type { CreateEventEodReportInput, PrismEventEodReport } from '@prism/types';
import { liveOpsScheduleRepository } from '../data/live-ops-schedule-repository';

export function submitEodReport(eventId: string, input: CreateEventEodReportInput): Promise<PrismEventEodReport> {
  return liveOpsScheduleRepository.submitEodReport(eventId, input);
}
