import type { EventOpsActorQuery } from '@prism/api-client';
import type { CreateEventEodReportInput, PrismEventEodReport } from '@prism/types';
import { liveOpsScheduleRepository } from '../data/live-ops-schedule-repository';

export function submitEodReport(eventId: string, input: CreateEventEodReportInput, actor?: EventOpsActorQuery): Promise<PrismEventEodReport> {
  return liveOpsScheduleRepository.submitEodReport(eventId, input, actor);
}
