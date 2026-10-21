import type { PrismEventSchedule } from '@prism/types';
import { liveOpsScheduleRepository } from '../data/live-ops-schedule-repository';

export function loadLiveOpsSchedule(eventId: string): Promise<PrismEventSchedule> {
  return liveOpsScheduleRepository.getSchedule(eventId);
}
