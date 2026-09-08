import type { EventOpsActorQuery } from '@prism/api-client';
import type { PrismEventSchedule } from '@prism/types';
import { liveOpsScheduleRepository } from '../data/live-ops-schedule-repository';

export function loadLiveOpsSchedule(eventId: string, actor?: EventOpsActorQuery): Promise<PrismEventSchedule> {
  return liveOpsScheduleRepository.getSchedule(eventId, actor);
}
