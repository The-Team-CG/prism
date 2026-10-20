import type { PrismEventRunSheetResult } from "@prism/types";
import { liveOpsScheduleRepository } from "../data/live-ops-schedule-repository";

export function loadRunSheet(eventId: string, dayId?: string): Promise<PrismEventRunSheetResult> {
  return liveOpsScheduleRepository.getRunSheet(eventId, dayId);
}
