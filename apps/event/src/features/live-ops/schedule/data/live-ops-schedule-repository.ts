import type { CreateEventEodReplyInput, CreateEventEodReportInput, SetEventEodIncompleteTasksInput, CreateEventHandoffInput, CreateEventScheduleDayInput, CreateEventScheduleSegmentInput, PrismCoordinatorEventSchedule, PrismEventEodReport, PrismEventHandoff, PrismEventRunSheetResult, PrismEventSchedule, PrismEventScheduleSegment, UpdateEventScheduleSegmentStatusInput } from '@prism/types';
import { eventApi } from '@/lib/prism-api';
import type { PrismEvent, StartEventDayResult } from '@prism/types';

export const liveOpsScheduleRepository = {
  getEvent(eventId: string): Promise<PrismEvent> { return eventApi.events.detail(eventId); },
  startEventDay(eventId: string): Promise<StartEventDayResult> { return eventApi.lifecycle.startEventDay(eventId); },
  getSchedule(eventId: string): Promise<PrismEventSchedule> { return eventApi.liveOps.schedule(eventId); },
  /** The published schedule and event status for a coordinator assigned to the event (the PMCM event read is refused to them). */
  getCoordinatorSchedule(eventId: string): Promise<PrismCoordinatorEventSchedule> { return eventApi.coordinator.eventSchedule(eventId); },
  createDay(eventId: string, input: CreateEventScheduleDayInput) { return eventApi.liveOps.createScheduleDay(eventId, input); },
  createSegment(eventId: string, dayId: string, input: CreateEventScheduleSegmentInput): Promise<PrismEventScheduleSegment> { return eventApi.liveOps.createScheduleSegment(eventId, dayId, input); },
  updateSegmentStatus(eventId: string, segmentId: string, input: UpdateEventScheduleSegmentStatusInput) { return eventApi.liveOps.updateScheduleSegmentStatus(eventId, segmentId, input); },
  getRunSheet(eventId: string, dayId?: string): Promise<PrismEventRunSheetResult> { return eventApi.liveOps.runSheet(eventId, dayId); },
  createHandoff(eventId: string, input: CreateEventHandoffInput): Promise<PrismEventHandoff> { return eventApi.liveOps.createHandoff(eventId, input); },
  listHandoffs(eventId: string): Promise<PrismEventHandoff[]> { return eventApi.liveOps.listHandoffs(eventId); },
  listEodReports(eventId: string): Promise<PrismEventEodReport[]> { return eventApi.liveOps.listEodReports(eventId); },
  submitEodReport(eventId: string, input: CreateEventEodReportInput): Promise<PrismEventEodReport> { return eventApi.liveOps.submitEodReport(eventId, input); },
  replyEodReport(eventId: string, reportId: string, input: CreateEventEodReplyInput) { return eventApi.liveOps.replyEodReport(eventId, reportId, input); },
  setEodIncompleteTasks(eventId: string, reportId: string, input: SetEventEodIncompleteTasksInput): Promise<PrismEventEodReport> { return eventApi.liveOps.setEodIncompleteTasks(eventId, reportId, input); },
};
